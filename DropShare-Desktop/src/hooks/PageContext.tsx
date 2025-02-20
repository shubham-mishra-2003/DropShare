import React, { createContext, useContext, useState } from "react";

interface PageContextProps {
  page: string;
  setPage: (page: string) => void;
}

const PageContext = createContext<PageContextProps | undefined>(undefined);

export const PageProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [page, setPage] = useState("home");
  return (
    <PageContext.Provider value={{ page, setPage }}>
      {children}
    </PageContext.Provider>
  );
};

export const usePage = () => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("usePage must be used within a PageProvider");
  }
  return context;
};
