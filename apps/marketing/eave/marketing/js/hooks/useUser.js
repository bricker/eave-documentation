// @ts-check
import { useContext } from "react";
import { useCookies } from "react-cookie";
import { AppContext } from "../context/Provider.js";
import * as Types from "../types.js"; // eslint-disable-line no-unused-vars
import { isHTTPError, isUnauthorized, logUserOut } from "../util/http-util.js";

const _EAVE_LOGIN_STATE_HINT_COOKIE_NAME = "ev_login_state_hint";

/**
 * @typedef {object} UserHook
 * @property {Types.DashboardUser | null} user
 * @property {boolean} isLoginHintSet
 * @property {() => void} getUserAccount
 */

/** @returns {UserHook} */
const useUser = () => {
  const { userCtx, dashboardNetworkStateCtx } = useContext(AppContext);
  const [cookies] = useCookies([_EAVE_LOGIN_STATE_HINT_COOKIE_NAME]);
  const [user, setUser] = userCtx;
  const [, setDashboardNetworkState] = dashboardNetworkStateCtx;

  const isLoginHintSet = cookies[_EAVE_LOGIN_STATE_HINT_COOKIE_NAME] === "1";

  /**
   * Asynchronously retrieves the user's account information from the server.
   * It updates the user's state to indicate loading, success, or error.
   * - Before the request, it sets `accountIsLoading` to true and `accountIsErroring` to false.
   * If the server responds with an unauthorized status, it logs the user out.
   * If the server responds with an HTTP error, it throws an error and sets `accountIsErroring` to true.
   * Otherwise, it updates the user's account information in the state and updates the `account` with the received data.
   * - After the request (whether it succeeded or failed), it sets `accountIsLoading` to false.
   */
  function getUserAccount() {
    setDashboardNetworkState((prev) => ({
      ...prev,
      accountIsLoading: true,
      accountIsErroring: false,
    }));

    fetch("/dashboard/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
      .then((resp) => {
        if (isUnauthorized(resp)) {
          logUserOut();
          return;
        }
        if (isHTTPError(resp)) {
          throw resp;
        }
        return resp.json().then((/** @type {Types.DashboardUser} */ data) => {
          setUser((prev) => ({
            ...prev,
            account: data.account,
          }));
          setDashboardNetworkState((prev) => ({
            ...prev,
            accountIsLoading: false,
          }));
        });
      })
      .catch(() => {
        setDashboardNetworkState((prev) => ({
          ...prev,
          accountIsLoading: false,
          accountIsErroring: true,
        }));
      });
  }

  return {
    user,
    isLoginHintSet,
    getUserAccount,
  };
};

export default useUser;
