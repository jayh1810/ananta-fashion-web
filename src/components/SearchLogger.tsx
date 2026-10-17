"use client";

import { useEffect } from "react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { addRecentSearch, logSearch } from "@/lib/search-history";

/** Records a /search visit: customer's recent searches + Admin search insights. */
export function SearchLogger({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    if (!query.trim()) return;
    addRecentSearch(query);
    logSearch(query, { resultCount, source: "search", token: useCustomerAuth.getState().token });
  }, [query, resultCount]);
  return null;
}
