import React, { useEffect, useRef, useState }  from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { Camera, CameraView, useCameraPermissions } from "expo-camera";



export default function TestPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  //const colorScheme = useColorScheme(); // "light" or "dark"
  //const theme = Colors[colorScheme ?? 'light'];
  
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLastCode(`${type}: ${data}`);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: "center" }}>
          Camera permission is required to scan barcodes.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeScreen includeBottomInset={false}>
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "code128"], // filter specific barcode types
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.button, scanned ? styles.buttonPrimary : styles.buttonDisabled]}
          disabled={!scanned}
          onPress={() => {
            setScanned(false);
            setLastCode(null);
          }}
        >
          <Text style={styles.btnText}>{scanned ? "Scan Again" : "Scanning..."}</Text>
        </TouchableOpacity>

        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Last Scan:</Text>
          <Text style={styles.resultText}>{lastCode ?? "—"}</Text>
        </View>
      </View>
    </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    camera: { flex: 1 },
    overlay: {
      position: "absolute",
      bottom: 0,
      width: "100%",
      backgroundColor: "rgba(0,0,0,0.35)",
      padding: 16,
      alignItems: "center",
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.2)",
      marginBottom: 10,
    },
    buttonPrimary: { backgroundColor: "rgba(0,122,255,0.9)" },
    buttonDisabled: { backgroundColor: "rgba(255,255,255,0.2)" },
    btnText: { color: "#fff", fontWeight: "600" },
    resultBox: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.5)",
      width: "100%",
    },
    resultTitle: { color: "#fff", fontWeight: "700", marginBottom: 4 },
    resultText: { color: "#fff", textAlign: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
