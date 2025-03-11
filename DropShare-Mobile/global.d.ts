declare module "react-native-wifi-hotspot" {
    export interface HotspotConfig {
        SSID: string;
        password: string;
    }

    export interface Peer {
        ip: string;
        deviceName: string;
    }

    const Hotspot: {
        enable: (success?: () => void, error?: (err: string) => void) => void;
        disable: (success?: () => void, error?: (err: string) => void) => void;
        create: (config: HotspotConfig, success: () => void, error: (err: string) => void) => void;
        getConfig: (success: (config: HotspotConfig) => void, error: (err: string) => void) => void;
        peersList: (success: (peers: string) => void, error: (err: string) => void) => void;
    };

    export default Hotspot;
}
