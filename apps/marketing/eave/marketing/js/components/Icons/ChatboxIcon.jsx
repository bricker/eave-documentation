import React from "react";

function ChatboxIcon({ className = undefined }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="10 12.5 40 38.59"
      className={className}
      width="40"
    >
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M48.828 13.672C50 14.843 50 16.729 50 20.5v29.586c0 .89-1.077 1.337-1.707.707l-8.147-8.147a.532.532 0 00-.154-.127c-.046-.019-.097-.019-.2-.019H18c-3.771 0-5.657 0-6.828-1.172C10 40.157 10 38.271 10 34.5v-14c0-3.771 0-5.657 1.172-6.828C12.343 12.5 14.229 12.5 18 12.5h24c3.771 0 5.657 0 6.828 1.172z"
        clipRule="evenodd"
      ></path>
      <path
        stroke="#3E3E3E"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M38.75 23.75h-17.5M38.75 31.25h-12.5"
      ></path>
    </svg>
  );
}

export default ChatboxIcon;
