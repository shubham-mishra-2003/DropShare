import React, { FC } from "react";
import { Image } from "react-native";
import { IconsStyles } from "../constants/Styles";
import { useTheme } from "../hooks/ThemeProvider";

interface IconProps {
  height: number;
  width: number;
  source: any;
  filter: number;
  resizeMode?: "cover" | "contain" | "stretch";
}

const Icon: FC<IconProps> = ({
  height,
  width,
  source,
  filter = 1,
  resizeMode = "cover",
}) => {
  const { colorScheme } = useTheme();

  const styles = IconsStyles(colorScheme, height, width, filter);

  return (
    <Image
      source={source}
      style={[styles.icon, { resizeMode: resizeMode }]}
      height={height}
      width={width}
    />
  );
};

export default Icon;
