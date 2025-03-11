// import React from "react";
// import { useTheme } from "../../hooks/ThemeProvider";
// import { Colors } from "../../constants/Colors";

// interface bottomSheerProps {
//   children: React.ReactNode;
//   visible: boolean;
//   onRequestClose?: () => void;
// }

// const BottomSheet = ({
//   children,
//   visible,
//   onRequestClose,
// }: bottomSheerProps) => {
//   const { colorScheme } = useTheme();
//   const styles = bottomSheetStyles(colorScheme);

//   return (
//     <div visible={visible} onRequestClose={onRequestClose}>
//       <div style={styles.overlay}>
//         <div style={styles.container}>
//           <div style={styles.line}></div>
//           <div style={{ height: "100%", width: "100%", paddingTop: 20 }}>
//             {children}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BottomSheet;

// const bottomSheetStyles = (colorScheme: "dark" | "light") => ({
//   overlay: {
//     position: "absolute",
//     top: 0,
//     left: 0,
//     bottom: 0,
//     right: 0,
//     justifyContent: "flex-end",
//   },
//   line: {
//     width: 40,
//     height: 5,
//     backgroundColor: "#bbb",
//     borderRadius: 50,
//   },
//   container: {
//     width: "100%",
//     height: 500,
//     backgroundColor: Colors[colorScheme].background,
//     borderTopLeftRadius: 40,
//     borderTopRightRadius: 40,
//     borderTopWidth: 2,
//     borderLeftWidth: 2,
//     borderRightWidth: 2,
//     borderColor: "#fff",
//     padding: 10,
//     justifyContent: "center",
//     alignItems: "center",
//   },
// });
