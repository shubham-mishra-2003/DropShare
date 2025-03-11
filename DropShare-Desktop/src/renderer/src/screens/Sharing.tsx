import FileTransfer from "../components/FileTransfer";
import Header from "../components/Header";

const Sharing = () => {
  return (
    <div className="flex flex-col size-full">
      <Header icon title="Sharing" />
      <h1 className="text-md">Sharing</h1>
      <FileTransfer />
    </div>
  );
};

export default Sharing;
