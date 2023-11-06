import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import useUser from "../../hooks/useUser";

/**
 * A component that checks if the user is logged in.
 * If the user is logged in, it renders the child components.
 * If the user is not logged in, it redirects to the home page.
 */
function PrivateRoutes() {
  const { isLoginHintSet } = useUser();
  return isLoginHintSet ? <Outlet /> : <Navigate to="/" />;
}

export default PrivateRoutes;
