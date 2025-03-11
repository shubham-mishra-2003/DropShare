import { useState } from "react";
import Header from "../components/Header";
import useUsername from "../hooks/useUsername";

const Settings = () => {
  const [inputValue, setInputValue] = useState("Dropshare_device");
  const { saveUsername } = useUsername();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      saveUsername(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="flex flex-col size-full">
      <Header icon title="Settings" />
      <h1 className="text-xl">Settings</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter username"
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default Settings;
