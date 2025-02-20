import {Dimensions} from 'react-native';
import { icons } from '../assets/assets';
import { useTheme } from '../hooks/ThemeProvider';

export const isBase64 = (str: string) => {
  const base64Regex =
    /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
  return base64Regex.test(str);
};

export const screenHeight = Dimensions.get('screen').height;
export const screenWidth = Dimensions.get('screen').width;
export const multiColor = [
  '#0B3D91',
  '#1E4DFF',
  '#104E8B',
  '#4682B4',
  '#6A5ACD',
  '#7B68EE',
];

export enum Colors {
  primary = '#007AFF',
  background = '#fff',
  text = '#222',
  theme = '#CF551F',
  secondary = '#E5EBF5',
  tertiary = '#3C75BE',
  secondary_light = '#F6F7F9',
}
