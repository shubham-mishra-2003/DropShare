import React from "react";
import Header from "../components/Header";
import { usePage } from "../hooks/PageContext";

const Sharing = () => {
  const { setPage } = usePage();
  return (
    <div className="flex flex-col size-full">
      <Header icon title="Sharing" />
      <h1 className="text-md">Sharing</h1>
    </div>
  );
};

export default Sharing;
