import { toast } from "react-hot-toast";
import { Colors } from "../constants/Colors";

interface ToastProps {
    type: "error" | "success";
    message: string;
    colorScheme?: "dark" | "light";
}

const Toast = ({ type, message, colorScheme = "dark" }: ToastProps) => {
    if (type === "error") {
        return toast.error(message, {
            style: {
                background:
                    colorScheme == "dark" ? "#fb2c36" : "oklch(0.704 0.191 22.216)",
                color: colorScheme == "dark" ? "#fff" : "#000",
                fontSize: 18,
                fontWeight: 900,
            },
        });
    } else if (type === "success") {
        return toast.success(message, {
            style: {
                background: Colors[colorScheme].transparent,
                color: colorScheme == "dark" ? "#fff" : "#000",
                fontSize: 18,
                fontWeight: 900,
                boxShadow: `0px 0px 5px ${Colors[colorScheme].tint}`,
                border: `2px solid ${Colors[colorScheme].tint}`,
            },
        });
    } else {
        return null;
    }
};

export default Toast;
