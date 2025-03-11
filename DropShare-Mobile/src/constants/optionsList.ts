interface constantProps {
    filePath: string;
    setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
}

const handleMove = () => {
    // Implement move logic here
};

const handleCopy = () => {
    // Implement copy logic here
};

const handleMoveToSafe = () => {
    // Implement move to safe logic here
};

const handleDelete = () => {
    // Implement delete logic here
};

const handleInfo = () => {
    // Implement file info logic here
};

const handleShare = (filePath: string, setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelectedFiles((prev) => [...prev, filePath]);
};

export const optionsList = ({ filePath, setSelectedFiles }: constantProps) => [
    { title: "Move", function: handleMove },
    { title: "Copy", function: handleCopy },
    { title: "Move to Safe Folder", function: handleMoveToSafe },
    { title: "Delete", function: handleDelete },
    { title: "File Info", function: handleInfo },
    { title: "Share", function: () => handleShare(filePath, setSelectedFiles) },
];
