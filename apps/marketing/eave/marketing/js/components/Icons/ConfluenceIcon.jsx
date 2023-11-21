import React from "react";

function ConfluenceIcon({ className = undefined }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 246"
      className={className}
      width="16"
      height="16"
    >
      <defs>
        <linearGradient
          id="a"
          x1="99.14%"
          x2="33.859%"
          y1="112.708%"
          y2="37.755%"
        >
          <stop offset="18%" stopColor="#0052CC"></stop>
          <stop offset="100%" stopColor="#2684FF"></stop>
        </linearGradient>
        <linearGradient
          id="b"
          x1=".926%"
          x2="66.18%"
          y1="-12.582%"
          y2="62.306%"
        >
          <stop offset="18%" stopColor="#0052CC"></stop>
          <stop offset="100%" stopColor="#2684FF"></stop>
        </linearGradient>
      </defs>
      <path
        fill="url(#a)"
        d="M9.26 187.33c-2.64 4.307-5.607 9.305-8.126 13.287a8.127 8.127 0 002.722 11.052l52.823 32.507a8.127 8.127 0 0011.256-2.763c2.113-3.536 4.835-8.127 7.801-13.044 20.926-34.538 41.974-30.312 79.925-12.19l52.376 24.908a8.127 8.127 0 0010.93-4.063l25.152-56.886a8.127 8.127 0 00-4.063-10.646c-11.052-5.201-33.034-15.562-52.823-25.111-71.189-34.579-131.691-32.344-177.972 42.949z"
      ></path>
      <path
        fill="url(#b)"
        d="M246.115 58.232c2.641-4.307 5.607-9.305 8.127-13.287a8.127 8.127 0 00-2.723-11.052L198.696 1.386a8.127 8.127 0 00-11.58 2.682c-2.113 3.535-4.835 8.127-7.802 13.043-20.926 34.538-41.974 30.313-79.925 12.19L47.176 4.515a8.127 8.127 0 00-10.93 4.063L11.093 65.465a8.127 8.127 0 004.063 10.645c11.052 5.202 33.035 15.563 52.823 25.112 71.351 34.538 131.854 32.222 178.135-42.99z"
      ></path>
    </svg>
  );
}

export default ConfluenceIcon;
