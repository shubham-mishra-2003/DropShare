import { saveToDatabase } from "./dropshareDb";
import { scanEntireStorage } from "./scanDirectory";

export const indexFiles = async () => {
    const files = await scanEntireStorage();
    saveToDatabase(files)
    console.log("File indexing completed.");
};
