import fs from "fs";
import path from "path";

export async function getFiles(drive: string) {
  if (!drive) {
    return { name: "Error", path: "", type: "directory", children: [] };
  }
  let absoluteDrive = /^[A-Z]$/i.test(drive) ? `${drive}:/` : drive;
  if (!path.isAbsolute(absoluteDrive)) {
    return { name: "Invalid Drive", path: "", type: "directory", children: [] };
  }
  function getDirectoryTree(dirPath: string): FileNode {
    let children: FileNode[] = [];
    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      children = files
        .filter(
          (file) =>
            file.name !== "$RECYCLE.BIN" &&
            file.name !== "System Volume Information",
        )
        .map<FileNode>((file) => {
          const fullPath = path.join(dirPath, file.name);
          return {
            name: file.name,
            path: fullPath,
            type: file.isDirectory() ? "directory" : "file",
            children: file.isDirectory()
              ? (getDirectoryTree(fullPath).children ?? [])
              : undefined,
          };
        });
    } catch (error: any) {
      if (error.code !== "EPERM") {
        console.error(`Error reading directory: ${dirPath}`, error);
      }
    }
    return {
      name: path.basename(dirPath) || dirPath,
      path: dirPath,
      type: "directory",
      children: children ?? [],
    };
  }
  return getDirectoryTree(absoluteDrive);
}
