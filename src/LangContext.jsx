import { createContext, useContext, useState } from "react";
import { LOCALES } from "./i18n";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("pivot_lang") || "cat");

  const setLanguage = (l) => {
    localStorage.setItem("pivot_lang", l);
    setLang(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLanguage, t: LOCALES[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
