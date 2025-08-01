import { KeyManagementServiceClient } from "@google-cloud/kms";
import { createHash, createVerify, constants as cryptoConstants } from "crypto";
import crc32c from "fast-crc32c";
import { sharedConfig } from "./config.js";
import { EaveApp, ExternalOrigin } from "./eave-origins.js";
import { InvalidChecksumError, InvalidSignatureError } from "./exceptions.js";
import { eaveLogger } from "./logging.js";
import { CtxArg } from "./requests.js";

const { RSA_PKCS1_PADDING } = cryptoConstants;

const KMS_KEYRING_LOCATION = "global";
const KMS_KEYRING_NAME = "primary";

enum SigningAlgorithm {
  RS256 = "RS256",
  ES256 = "ES256",
}

type SigningKeyDetails = {
  id: string;
  version: string;
  algorithm: SigningAlgorithm;
};

// map from a SigningKeyDetails "hash" to a PEM string
const PUBLIC_KEYS_CACHE: { [key: string]: string } = {};

const SIGNING_KEYS: { [key: string]: SigningKeyDetails } = {
  [EaveApp.eave_api]: {
    id: "eave-api-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  [EaveApp.eave_www]: {
    id: "eave-www-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  // This key was generated by Google, and is used to sign requests between the GitHub App and the Eave Core API.
  [EaveApp.eave_github_app]: {
    id: "eave-github-app-signing-key-02",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  [EaveApp.eave_slack_app]: {
    id: "eave-slack-app-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  [EaveApp.eave_atlassian_app]: {
    id: "eave-atlassian-app-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  [EaveApp.eave_jira_app]: {
    id: "eave-jira-app-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  [EaveApp.eave_confluence_app]: {
    id: "eave-confluence-app-signing-key",
    version: "1",
    algorithm: SigningAlgorithm.ES256,
  },
  // This key was downloaded from GitHub, and then imported into KMS. It is used to sign requests between Eave and GitHub.
  // This is not currently used
  [ExternalOrigin.github_api_client]: {
    id: "eave-github-app-signing-key-01",
    version: "2",
    algorithm: SigningAlgorithm.RS256,
  },
};

export default class Signing {
  /**
   * proxy constructor for easier stubbing in tests.
   * */
  static new(signer: string): Signing {
    return new Signing(signer);
  }

  signingKey: SigningKeyDetails;

  signingKeyVersion: string;

  constructor(signer: string) {
    this.signingKey = this.getKey(signer);
    this.signingKeyVersion = this.getVersion(this.signingKey);
  }

  private getKey(signer: string): SigningKeyDetails {
    const keyDetails = SIGNING_KEYS[signer];
    if (keyDetails === undefined) {
      throw Error(`No signing key details found for ${signer}`);
    }
    return keyDetails;
  }

  private getVersion(key: SigningKeyDetails): string {
    const { version } = key;
    return version;
  }

  /**
   * Signs the data with GCP KMS and returns base64-encoded signature.
   * Throws InvalidChecksumError if any data is missing from the signing result.
   *
   * @param signingKey key to sign the data payload with
   * @param data payload to sign using the `signingKey`
   */
  async signBase64(data: string | Buffer): Promise<string> {
    const kmsClient = new KeyManagementServiceClient();
    const keyVersionName = kmsClient.cryptoKeyVersionPath(
      sharedConfig.googleCloudProject,
      KMS_KEYRING_LOCATION,
      KMS_KEYRING_NAME,
      this.signingKey.id,
      this.signingKeyVersion,
    );

    let messageBytes: Buffer;
    if (typeof data === "string") {
      // this byte encoding must match the python `bytes` type in order
      // to not break signing validation in the python core_api middleware
      messageBytes = Buffer.from(data, "utf8");
    } else {
      messageBytes = data;
    }

    const digest = createHash("sha256").update(messageBytes).digest();
    const digestCrc32c = this.generateChecksum(digest);

    const [signedResponse] = await kmsClient.asymmetricSign({
      name: keyVersionName,
      digest: { sha256: digest },
      digestCrc32c: {
        value: digestCrc32c.toString(10), // convert to base 10 just in case
      },
    });

    if (!signedResponse.signature) {
      throw new InvalidChecksumError("No signature from server");
    }

    if (!signedResponse.signatureCrc32c?.value) {
      throw new InvalidChecksumError("No signature checksum from server");
    }

    if (!signedResponse.verifiedDigestCrc32c) {
      throw new InvalidChecksumError("Server could not verify client checksum");
    }

    if (signedResponse.name !== keyVersionName) {
      throw new InvalidChecksumError("Name mismatch");
    }

    const crc32value = signedResponse.signatureCrc32c.value;
    let crc32cint: number;
    if (typeof crc32value === "string") {
      crc32cint = parseInt(crc32value, 10);
    } else {
      // crc32value can be a Long, which is covered by number
      crc32cint = <number>crc32value;
    }

    this.validateChecksumOrException(
      Buffer.from(signedResponse.signature),
      crc32cint,
    );

    return Buffer.from(signedResponse.signature.valueOf()).toString("base64");
  }

  private generateChecksum(data: Buffer): number {
    return crc32c.calculate(data);
  }

  private validateChecksumOrException(data: Buffer, checksum: number): void {
    if (this.generateChecksum(data) !== checksum) {
      throw new InvalidChecksumError("CRC32C checksums did not match");
    }
  }

  async verifySignatureOrException(
    message: string | Buffer,
    signature: string | Buffer,
  ): Promise<void> {
    let signatureString: string;
    if (typeof signature === "string") {
      signatureString = signature;
    } else {
      // convert from buffer to b64 string
      signatureString = Buffer.from(signature).toString("base64");
    }

    const pem = await this.getPublicKey();

    let isVerified = false;

    switch (this.signingKey.algorithm) {
      case SigningAlgorithm.RS256: {
        const verify = createVerify("RSA-SHA256");
        verify.update(message);
        verify.end();
        isVerified = verify.verify(
          { key: pem, padding: RSA_PKCS1_PADDING },
          signatureString,
          "base64",
        );
        break;
      }
      case SigningAlgorithm.ES256: {
        // Algorithm for our keys is EC_SIGN_P256_SHA256
        const verify = createVerify("sha256");
        verify.update(message);
        verify.end();
        isVerified = verify.verify(pem, signatureString, "base64");
        break;
      }
      default:
        throw new InvalidSignatureError(
          `Unsupported algorithm: ${this.signingKey.algorithm}`,
        );
    }

    if (!isVerified) {
      throw new InvalidSignatureError("Signature failed verification");
    }
  }

  /**
   * Makes a network request to Google KMS to fetch the
   * public key associated with `sigining_key`.
   * @param signingKey
   * @returns a public key PEM file content
   */
  private async fetchPublicKey(): Promise<string> {
    const kmsClient = new KeyManagementServiceClient();

    const keyVersionName = kmsClient.cryptoKeyVersionPath(
      sharedConfig.googleCloudProject,
      KMS_KEYRING_LOCATION,
      KMS_KEYRING_NAME,
      this.signingKey.id,
      this.signingKeyVersion,
    );

    const [kmsPublicKey] = await kmsClient.getPublicKey({
      name: keyVersionName,
    });

    if (!kmsPublicKey.pem) {
      throw new InvalidSignatureError("KMS public key was unexpectedly null");
    }

    return kmsPublicKey.pem;
  }

  /**
   * Get the public key PEM associated with `signing_key`,
   * or from an in-memory cache if previously computed.
   *
   * @param signingKey
   * @returns a public key PEM file content
   */
  private async getPublicKey(): Promise<string> {
    const cacheKey = `${this.signingKey.id}${
      this.signingKey.version
    }${this.signingKey.algorithm.toString()}`;
    if (PUBLIC_KEYS_CACHE[cacheKey] !== undefined) {
      return PUBLIC_KEYS_CACHE[cacheKey]!;
    }
    const result = await this.fetchPublicKey();
    PUBLIC_KEYS_CACHE[cacheKey] = result;
    return result;
  }
}

export function buildMessageToSign({
  method,
  path,
  ts,
  requestId,
  audience,
  origin,
  payload,
  teamId,
  accountId,
  ctx,
}: CtxArg & {
  method: string;
  path: string;
  ts: number;
  requestId: string;
  audience: EaveApp;
  origin: EaveApp | string;
  payload: string;
  teamId?: string;
  accountId?: string;
}): string {
  const signatureElements = [
    origin,
    method.toUpperCase(),
    audience,
    path,
    ts.toString(),
    requestId,
    payload,
  ];

  if (teamId !== undefined) {
    signatureElements.push(teamId);
  }
  if (accountId !== undefined) {
    signatureElements.push(accountId);
  }

  const signature_message = signatureElements.join(":");
  eaveLogger.debug("signature message", ctx, { signature_message });
  return signature_message;
}

export function makeSigTs(): number {
  return Math.trunc(Date.now() / 1000);
}
