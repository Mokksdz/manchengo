# QR Scanner Setup (Phase B1)

## Android Permissions

When the Flutter project is built, add these permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Camera permission for QR scanning -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="true" />
    
    <application ...>
</manifest>
```

## QR Format

```
MCG:{TYPE}:{SHORT_ID}
```

| Component | Description | Example |
|-----------|-------------|---------|
| MCG | Fixed prefix | MCG |
| TYPE | Entity type | MP, PF, PROD, CLI |
| SHORT_ID | 8-12 uppercase alphanumeric | A1B2C3D4E5 |

## Usage

### Basic Scan
```dart
import 'package:manchengo_mobile/features/qr/qr.dart';

final payload = await scanQr(context);
if (payload != null) {
  print('Type: ${payload.type}');
  print('ID: ${payload.shortId}');
}
```

### Scan for Specific Type
```dart
final lotMp = await scanQrForType(context, QrEntityType.mp);
```

### Manual Parsing
```dart
import 'package:manchengo_mobile/core/qr/qr.dart';

try {
  final payload = QrParser.parse('MCG:PF:A1B2C3D4E5');
} on InvalidQrCodeError catch (e) {
  print(e.message);
}
```
