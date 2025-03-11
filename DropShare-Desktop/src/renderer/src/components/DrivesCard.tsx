import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/ThemeProvider';
import Toast from './Toast';
import { useDirectory } from '../hooks/DirectoryContext';
import { Colors } from '../constants/Colors';

const DrivesCard = () => {
    const [drives, setDrives] = useState<DriveInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { colorScheme } = useTheme();

    useEffect(() => {
        window.electron
            .getDrives()
            .then((data: DriveInfo[]) => {
                setDrives(data);
                setLoading(false);
            })
            .catch((error) => {
                Toast({ type: "error", message: `Error fetching drives: ${error}` });
                setLoading(false);
            });
    }, []);

    const { setSelectedPath } = useDirectory();

    const handleDriveClick = (drive: string) => {
        navigate(`/files/${encodeURIComponent(drive)}`);
        setSelectedPath(drive);
    };

    if (loading)
        return (
            <div
                style={{
                    backgroundColor: Colors[colorScheme].transparent,
                }}
                className="h-48 justify-center flex items-center text-2xl font-bold w-full rounded-xl animate-pulse"
            >
                Getting drives info...
            </div>
        );

    return (
        <div className="grid sm-p-5 p-2 w-full gap-7 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
            {drives.length > 0 ? (
                drives.map(({ name, drive, total, free }, index) => {
                    const used = total - free;

                    const totalGB = (total / 1e9).toFixed(2);
                    const usedGB = (used / 1e9).toFixed(2);
                    const freeGB = (free / 1e9).toFixed(2);

                    return (
                        <div
                            key={index}
                            onClick={() => handleDriveClick(drive)}
                            className={`flex duration-300 hover:border-2 hover:shadow-lg gap-3 cursor-pointer flex-col rounded-xl min-h-48 justify-between p-4 ${colorScheme == "dark" ? "border-[#308ffc] shadow-[#308ffc]" : "border-blue-400 shadow-blue-400"}`}
                            style={{
                                backgroundColor: Colors[colorScheme].transparent,
                            }}
                        >
                            <h1 className="text-2xl font-bold">{`${name} (${drive}:)`}</h1>
                            <div className="flex flex-col">
                                <div className="flex justify-center flex-col items-center gap-2">
                                    <h1 className="text-xl font-bold w-full text-end">
                                        Available - {freeGB} GB
                                    </h1>
                                    <div
                                        className="w-full p-[2px] h-4 rounded-xl"
                                        style={{ background: Colors[colorScheme].transparent }}
                                    >
                                        <div
                                            style={{
                                                width: total > 0 ? `${(used / total) * 100}%` : "0%",
                                                height: "100%",
                                                borderRadius: 20,
                                                backgroundColor: Colors[colorScheme].tint,
                                            }}
                                        />
                                    </div>
                                    <div className="flex font-bold truncate justify-start w-full items-end gap-2">
                                        <h1 className="text-xl">{usedGB} GB</h1>
                                        <span className="text-2xl">|</span>
                                        <h1 className="text-3xl">{totalGB} GB</h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="w-full text-center">No drives found</div>
            )}
        </div>
    )
}

export default DrivesCard
