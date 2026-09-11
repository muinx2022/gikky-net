import "react-native";

declare module "react-native" {
  interface TextStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | any;
    color?: any;
    [key: string]: any;
  }
  interface ViewStyle {
    [key: string]: any;
  }
}
