import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, LayoutChangeEvent, Alert,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useNavigation, useRoute } from "@react-navigation/native";
import { lookupProductByBarcode, mapOFFToPrefill } from "../lib/openFoodFacts";

type RouteParams = {
  userId?: string;
  dateISO?: string;
};

export default function UpcScanner() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route?.params ?? {}) as RouteParams;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);

  const [busy, setBusy] = useState(false);
  const lastScanAt = useRef(0);

  const onBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - lastScanAt.current < 900) return; // throttle duplicate callbacks
    lastScanAt.current = now;

    const code = result.data?.trim();
    if (!code) return;

    try {
      setBusy(true);

      const product = await lookupProductByBarcode(code);
      if (!product) {
        Alert.alert("Not found", `No product found for UPC/EAN: ${code}`);
        setBusy(false);
        return;
      }

      const prefill = mapOFFToPrefill(product);

      // Navigate to FoodEntry with prefilled data and the context we came with
      navigation.navigate("FoodEntry", {
        userId: params.userId,
        dateISO: params.dateISO,
        prefill,             // 👈 your form can use this to default values
        source: "barcode",   // optional flag
        upc: code,
      });
    } catch (e: any) {
      console.warn(e);
      Alert.alert("Lookup error", e?.message ?? "Failed to fetch product data");
    } finally {
      setBusy(false);
    }
  }, [navigation, params?.userId, params?.dateISO]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>We need camera access to scan barcodes.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Camera Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={onBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
        }}
      />

      <ReticleOverlayPure />

      <View style={styles.pill}>
        {busy ? <ActivityIndicator /> : <Text style={styles.pillText}>Align the barcode in the box</Text>}
      </View>
    </View>
  );
}

/** Pure-View overlay measured from actual layout (no half-height bugs) */
function ReticleOverlayPure() {
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDims((d) => (d.w === width && d.h === height ? d : { w: width, h: height }));
  };

  const hasSize = dims.w > 0 && dims.h > 0;
  const BOX_WIDTH = Math.min(dims.w * 0.75, 320);
  const BOX_HEIGHT = 160;
  const topMaskH = (dims.h - BOX_HEIGHT) / 2;
  const sideMaskW = (dims.w - BOX_WIDTH) / 2;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {hasSize && (
        <>
          {/* top/bottom masks */}
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: topMaskH }]} />
          <View style={[styles.dim, { bottom: 0, left: 0, right: 0, height: topMaskH }]} />
          {/* side masks */}
          <View style={[styles.dim, { top: topMaskH, bottom: topMaskH, left: 0, width: sideMaskW }]} />
          <View style={[styles.dim, { top: topMaskH, bottom: topMaskH, right: 0, width: sideMaskW }]} />
          {/* reticle */}
          <View style={[styles.box, { left: sideMaskW, top: topMaskH, width: BOX_WIDTH, height: BOX_HEIGHT }]}>
            <Corner style={{ top: -2, left: -2, transform: [{ rotate: "0deg" }] }} />
            <Corner style={{ top: -2, right: -2, transform: [{ rotate: "90deg" }] }} />
            <Corner style={{ bottom: -2, right: -2, transform: [{ rotate: "180deg" }] }} />
            <Corner style={{ bottom: -2, left: -2, transform: [{ rotate: "270deg" }] }} />
          </View>
        </>
      )}
    </View>
  );
}

function Corner({ style }: { style?: any }) {
  return (
    <View
      style={[
        { position: "absolute", width: 28, height: 28, borderColor: "white", borderTopWidth: 4, borderLeftWidth: 4, borderRadius: 4 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  msg: { fontSize: 16, textAlign: "center" },
  btn: { backgroundColor: "#0a84ff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "600" },
  dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.45)" },
  box: { position: "absolute", borderWidth: 2, borderColor: "white", borderRadius: 12, backgroundColor: "rgba(0,0,0,0.04)" },
  pill: { position: "absolute", bottom: 28, left: 24, right: 24, alignSelf: "center", alignItems: "center", paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999 },
  pillText: { color: "white", fontWeight: "600" },
});
