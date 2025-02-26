import { useState } from "react";
import EmailSearch from "@/components/email-search";
import EmailList from "@/components/email-list";

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [folder, setFolder] = useState("");

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Emails</h1>
      
      <EmailSearch
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        folder={folder}
        onFolderChange={setFolder}
      />

      <EmailList
        search={search}
        category={category}
        folder={folder}
      />
    </div>
  );
}
