import React from "react";

const ExpandIcon = ({ color = "white", up = false, lg = false }) => {
  if (lg) {
    if (up) {
      return (
        <svg
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke={color}
            strokeWidth="2"
            d="M7.5 18.75L15 11.25L22.5 18.75"
          />
        </svg>
      );
    }
    return (
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke={color}
          strokeWidth="2"
          d="M22.5 11.25L15 18.75L7.5 11.25"
        />
      </svg>
    );
  }
  if (up) {
    return (
      <svg
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path stroke={color} d="M6.25 15.625L12.5 9.375L18.75 15.625" />
      </svg>
    );
  }
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path stroke={color} d="M18.75 9.375L12.5 15.625L6.25 9.375" />
    </svg>
  );
};

export default ExpandIcon;
