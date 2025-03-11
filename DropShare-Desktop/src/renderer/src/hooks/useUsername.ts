import { useState } from "react";

const useUsername = () => {
  const [username, setUsername] = useState<string>(
    localStorage.getItem("username") || "DropShare_User",
  );
  const saveUsername = (newUsername: string) => {
    localStorage.setItem("username", newUsername);
    setUsername(newUsername);
  };

  return { username, saveUsername };
};

export default useUsername;
