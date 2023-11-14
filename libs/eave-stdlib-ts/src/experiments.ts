import { promises as fs } from "node:fs";
import OpenAIClient, { formatprompt } from "./transformer-ai/openai.js";

const EAVE_HOME = process.env["EAVE_HOME"];
const SEED = 26892;

async function main() {
  const eaveClient = await OpenAIClient.getAuthedClient();
  const rawClient = eaveClient.client;

  const fileContent = await fs.readFile(`${EAVE_HOME}/apps/core/eave/core/public/requests/oauth/github_oauth.py`, "utf8")

  const stream = await rawClient.chat.completions.create({
    model: "gpt-4-1106-preview",
    seed: SEED,
    stream: true,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: formatprompt(
          "Create a syntax tree for the following code. Output the syntax tree as a JSON document.\n",
          "###",
          fileContent,
          "###",
        ),
      },
    ],
  });

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (choice) {
      process.stdout.write(choice.delta.content || "");

      if (choice.finish_reason !== null) {
        process.stdout.write("\n\n");
        console.dir(chunk);
      }
    }
  }
}

void main();