import { useTheme } from "../hooks/ThemeProvider";
import { FC } from "react";

interface IconProps {
    height?: number;
    width?: number;
    src: any;
    filter?: number;
    onClick?: () => void;
    className?: string;
}

const Icon: FC<IconProps> = ({
    height = 25,
    width = 25,
    src,
    filter = 1,
    onClick,
    className,
}) => {
    const { colorScheme } = useTheme();

    return (
        <img
            src={src}
            height={height}
            width={width}
            className={className}
            style={{
                height,
                width,
                filter: colorScheme === "dark" ? `invert(${filter})` : "none",
                cursor: onClick ? "pointer" : "default",
            }}
            onClick={onClick}
        />
    );
};

export default Icon;
