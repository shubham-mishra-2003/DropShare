import { View, Text, TouchableOpacity } from "react-native";
import React, { FC } from "react";
import Icon from "./Icon";

const Options: FC<{
  isHome?: boolean;
  onMediaPickedUp?: (media: any) => void;
  onFilePickedUp?: (file: any) => void;
}> = ({ isHome, onFilePickedUp, onMediaPickedUp }) => {
  const options = [
    { name: "", icon: "" },
    { name: "", icon: "" },
    { name: "", icon: "" },
    { name: "", icon: "" },
  ];


//   1:06:30
  return (
    <View>
      {options.map((option) => (
        <TouchableOpacity>
          <Icon source={option.icon} filter={1} height={30} width={30} />
          <Text>{option.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default Options;
