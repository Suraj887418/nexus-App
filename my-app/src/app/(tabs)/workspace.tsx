import React, { useState } from 'react';
import {  View, Text, StyleSheet, ScrollView, Pressable, Animated, Dimensions, Share, Alert, Modal, ActivityIndicator , FlatList } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Print from 'expo-print';
import * as ExpoLocation from 'expo-location';
import { WebView } from 'react-native-webview';
import { API_BASE_URL } from '../../store';
const { width } = Dimensions.get('window');

export default function WorkspaceScreen() {
  const params = useLocalSearchParams();
  const caseId = params.caseId || 'CASE-1021';

  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [completedSections, setCompletedSections] = useState<Record<string, boolean>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, Record<'gallery' | 'scan' | 'gps', string[]>>>({});
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Dummy documents data
  const caseDocuments = [
    { id: '1', title: 'Claim_Form_Signed.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: '2', title: 'Hospital_Bill_Final.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }
  ];

  const authLetters = [
    { id: '1', title: 'Authorised_Letter_Approval.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }
  ];

  const handleShare = async (title: string, url: string) => {
    try {
      await Share.share({
        message: `Please find the authorized letter attached: ${title}\nLink: ${url}`,
        title: title});
    } catch (error) {
      Alert.alert('Error', 'Failed to share document');
    }
  };

  const handleDownload = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the document for downloading');
    });
  };

  const [avrModalVisible, setAvrModalVisible] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const hiddenCameraRef = React.useRef<any>(null);
  const [isHiddenVideoRecording, setIsHiddenVideoRecording] = useState(false);
  const [hiddenCameraType, setHiddenCameraType] = useState<'front' | 'back'>('front');

  // Live GPS Camera States
  const [liveCameraVisible, setLiveCameraVisible] = useState(false);
  const [liveCameraLocation, setLiveCameraLocation] = useState<any>(null);
  const [liveCameraSectionId, setLiveCameraSectionId] = useState<string | null>(null);
  const liveCameraRef = React.useRef<any>(null);
  const [liveCameraType, setLiveCameraType] = useState<'front' | 'back'>('back');
  const [currentAddress, setCurrentAddress] = useState<string>('');

  // Scan Camera States
  const [scanCameraVisible, setScanCameraVisible] = useState(false);
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [scanSectionId, setScanSectionId] = useState<string | null>(null);
  const [scanCameraLocationText, setScanCameraLocationText] = useState('');
  const scanCameraRef = React.useRef<any>(null);
  const [scanGalleryVisible, setScanGalleryVisible] = useState(false);
  const [scanTorchEnabled, setScanTorchEnabled] = useState(false);
  const [scanReviewVisible, setScanReviewVisible] = useState(false);
  const [scanGridVisible, setScanGridVisible] = useState(false);

  // Loading / Processing Overlay States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // HTML Preview and Upload Config States
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewType, setPreviewType] = useState<'gps' | 'scan'>('gps');
  const [tempPdfData, setTempPdfData] = useState<{ sectionId?: string; cameraType?: string; source?: 'gallery' | 'scan' | 'gps' } | null>(null);

  // Native Image Preview States
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewLocationText, setPreviewLocationText] = useState<string>('');
  const [previewAddress, setPreviewAddress] = useState<string>('');

  const openReviewModal = (sectionId: string, source: 'gallery' | 'scan' | 'gps') => {
    const sectionImages = uploadedImages[sectionId] || {};
    const images = sectionImages[source];
    if (images && images.length > 0) {
      setPreviewImages(images);
      setPreviewType(source === 'gps' ? 'gps' : source === 'gallery' ? 'gallery' : 'scan');
      setIsReviewMode(true);
      setPreviewModalVisible(true);
    } else {
      Alert.alert("No Images", "No images available for review in this section yet.");
    }
  };

  const openAvrMenu = (id: string) => {
    setActiveSectionId(id);
    setAvrModalVisible(true);
  };

  const openLiveCamera = async (sectionId: string) => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    const locPerm = await ExpoLocation.requestForegroundPermissionsAsync();
    
    if (!camPerm.granted || !locPerm.granted) {
      Alert.alert("Permissions Required", "Camera and Location permissions are required for Live GPS Photo.");
      return;
    }

    setLiveCameraSectionId(sectionId);
    setLiveCameraVisible(true);

    try {
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
      setLiveCameraLocation(loc);
      const reverseGeocode = await ExpoLocation.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        setCurrentAddress(`${addr.name || ''} ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.replace(/ ,/g, ',').trim().replace(/^,|,$/g, ''));
      }
    } catch(e) {
      console.log("Error getting location", e);
    }
  };

  const captureLivePhoto = async () => {
    if (liveCameraRef.current) {
      try {
        const photo = await liveCameraRef.current.takePictureAsync({ quality: 0.7 });
        setLiveCameraVisible(false);
        
        setIsProcessing(true);
        setProcessingMessage("Generating GPS Photo...");
        
        const locText = liveCameraLocation ? `Lat: ${liveCameraLocation.coords.latitude.toFixed(6)}, Lng: ${liveCameraLocation.coords.longitude.toFixed(6)}` : 'Location unavailable';
        const dateText = new Date().toLocaleString();
        
        let imgTag = `
          <div style="position:relative; display:inline-block; margin-bottom:20px; text-align:center;">
            <img src="${photo.uri}" style="max-width:100%; max-height:85vh; border:2px solid #ccc; display:block;" />
            <div style="position:absolute; bottom:20px; left:20px; right:20px; background-color: rgba(0,0,0,0.7); color: white; padding: 15px; font-size: 16px; text-align:left; border-radius:8px; font-family:monospace;">
                <b>📍 Live GPS Capture</b><br/>
                ${currentAddress ? currentAddress + '<br/>' : ''}
                ${locText}<br/>
                ${dateText}
            </div>
          </div>
        `;

        const html = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
              <style>
                body { margin: 0; padding: 15px; font-family: -apple-system, sans-serif; background-color: #f1f5f9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
                .card { position: relative; width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
                img { width: 100%; display: block; height: auto; max-height: 70vh; object-fit: contain; background: #000; }
                .overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.85); color: #fff; padding: 16px; font-size: 13px; text-align: left; font-family: monospace; border-top: 1px solid rgba(255,255,255,0.1); }
                .title { font-weight: bold; font-size: 15px; margin-bottom: 6px; color: #10B981; font-family: sans-serif; }
              </style>
            </head>
            <body>
              <div class="card">
                <img src="${photo.uri}" />
                <div class="overlay">
                  <div class="title">📍 LIVE GPS CAPTURE</div>
                  ${currentAddress ? currentAddress + '<br/>' : ''}
                  ${locText}<br/>
                  ${dateText}
                </div>
              </div>
            </body>
          </html>
        `;

        setTempPdfData({
          sectionId: liveCameraSectionId || 'unknown',
          cameraType: liveCameraType,
          source: 'gps'
        });
        setPreviewImages([photo.uri]);
        setPreviewLocationText(locText);
        setPreviewAddress(currentAddress);
        setPreviewHtml(html);
        setPreviewType('gps');
        setPreviewModalVisible(true);
      } catch (err) {
        Alert.alert("Error", "Failed to capture photo");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const openScanCamera = async (sectionId: string) => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert("Permission Required", "Camera permission is required!");
      return;
    }
    
    let locationText = '';
    const locPerm = await ExpoLocation.requestForegroundPermissionsAsync();
    if (locPerm.granted) {
      try {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
        locationText = `Lat: ${loc.coords.latitude.toFixed(6)}, Lng: ${loc.coords.longitude.toFixed(6)} | ${new Date().toLocaleString()}`;
      } catch(e) {}
    }

    setScanCameraLocationText(locationText);
    setScanSectionId(sectionId);
    setScannedImages([]);
    setScanCameraVisible(true);
  };

  const captureScanPhoto = async () => {
    if (scanCameraRef.current) {
      try {
        const photo = await scanCameraRef.current.takePictureAsync({ quality: 0.7 });
        setScannedImages(prev => [...prev, photo.uri]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      } catch (err) {
        Alert.alert("Error", "Failed to capture photo");
      }
    }
  };

  const finishScanning = () => {
    if (scannedImages.length === 0) {
      setScanCameraVisible(false);
      return;
    }
    setScanReviewVisible(true);
  };

  const generatePdfFromScans = async () => {
    setScanReviewVisible(false);
    setScanCameraVisible(false);
    
    setIsProcessing(true);
    setProcessingMessage("Generating PDF preview...");
    
    let imgTags = scannedImages.map(uri => `
      <div style="position:relative; display:inline-block; margin-bottom:20px; text-align:center;">
        <img src="${uri}" style="max-width:100%; max-height:85vh; border:2px solid #ccc; display:block;" />
        ${scanCameraLocationText ? `<div style="position:absolute; bottom:10px; left:10px; right:10px; background-color: rgba(0,0,0,0.6); color: white; padding: 10px; font-size: 14px; text-align:left; border-radius:5px; font-family:monospace;">📍 GPS Location:<br/>${scanCameraLocationText}</div>` : ''}
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body { margin: 0; padding: 15px; font-family: -apple-system, sans-serif; background-color: #f1f5f9; display: flex; flex-direction: column; align-items: center; }
            .card { position: relative; width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; margin-bottom: 20px; }
            img { width: 100%; display: block; height: auto; max-height: 70vh; object-fit: contain; background: #000; }
            .overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.85); color: #fff; padding: 12px; font-size: 11px; text-align: left; font-family: monospace; }
            .title { font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #3B82F6; font-family: sans-serif; }
          </style>
        </head>
        <body>
          ${scannedImages.map(uri => `
            <div class="card">
              <img src="${uri}" />
              ${scanCameraLocationText ? `
                <div class="overlay">
                  <div class="title">📍 GPS LOCATION</div>
                  ${scanCameraLocationText}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;
    
    setTempPdfData({
      sectionId: scanSectionId || 'unknown',
      cameraType: 'back',
      source: 'scan'
    });
    setPreviewImages(scannedImages);
    setPreviewLocationText(scanCameraLocationText);
    setPreviewAddress('');
    setPreviewHtml(html);
    setPreviewType('scan');
    setPreviewModalVisible(true);
    setIsProcessing(false);
  };

  const uploadMedia = async (uri: string, mediaType: 'audio' | 'video' | 'document', cameraType: string, sectionIdToUse?: string) => {
    setIsProcessing(true);
    setProcessingMessage(`Uploading ${mediaType}...`);
    try {
      const formData = new FormData();
      
      let filename, type;
      if (mediaType === 'audio') {
        filename = uri.split('/').pop() || 'recording.m4a';
        type = 'audio/m4a';
      } else if (mediaType === 'video') {
        filename = uri.split('/').pop() || 'video.mp4';
        type = 'video/mp4';
      } else {
        filename = uri.split('/').pop() || 'document.pdf';
        type = 'application/pdf';
      }

      formData.append('file', {
        uri,
        name: filename,
        type} as any);

      const currentSectionId = sectionIdToUse || activeSectionId || 'unknown';
      formData.append('caseNumber', Array.isArray(caseId) ? caseId[0] : caseId);
      formData.append('sectionId', currentSectionId);
      formData.append('mediaType', mediaType);
      formData.append('cameraType', cameraType);

      // Using the same base URL as the other fetch calls in store
      const response = await fetch(`${API_BASE_URL}/api/upload-media`, {
        method: 'POST',
        body: formData as any,
        headers: {
        }});

      const data = await response.json();
      setIsProcessing(false);
      setTimeout(() => {
        if (data.success) {
          if (currentSectionId !== 'unknown') {
            setCompletedSections(prev => ({ ...prev, [currentSectionId]: true }));
          }
          Alert.alert("Success", "File uploaded and saved to database successfully!");
        } else {
          Alert.alert("Error", data.message || "Upload failed");
        }
      }, 200);
    } catch (error) {
      setIsProcessing(false);
      console.error("Upload error:", error);
      setTimeout(() => {
        Alert.alert("Error", "Network error while uploading");
      }, 200);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewHtml || !tempPdfData) return;
    
    setPreviewModalVisible(false);
    setIsProcessing(true);
    setProcessingMessage("Generating PDF...");
    
    try {
      // 1. Generate PDF from HTML
      const { uri: pdfUri } = await Print.printToFileAsync({ html: previewHtml });
      
      // 2. Upload using the configuration saved in tempPdfData
      const currentSectionId = tempPdfData.sectionId || 'unknown';
      setActiveSectionId(currentSectionId);
      if (currentSectionId !== 'unknown') {
        const source = tempPdfData.source || 'gallery';
        setUploadedImages(prev => {
          const sectionImages = prev[currentSectionId] || {} as Record<'gallery' | 'scan' | 'gps', string[]>;
          const sourceImages = sectionImages[source] || [];
          return {
            ...prev,
            [currentSectionId]: {
              ...sectionImages,
              [source]: [...sourceImages, ...previewImages]
            }
          };
        });
      }
      await uploadMedia(pdfUri, 'document', tempPdfData.cameraType || 'none', currentSectionId);
    } catch (err) {
      Alert.alert("Error", "Failed to generate or upload PDF");
    } finally {
      setIsProcessing(false);
      setPreviewHtml(null);
      setTempPdfData(null);
      setIsReviewMode(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewModalVisible(false);
    setPreviewHtml(null);
    setTempPdfData(null);
    setIsReviewMode(false);
  };

  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const startAudioRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true});
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
        setAvrModalVisible(false);
        
        // Setup a listener or alert to stop
        Alert.alert("Recording Started", "Audio is recording in background... Press Stop when done.", [
          { 
            text: "Stop Recording", 
            onPress: async () => {
              try {
                await newRecording.stopAndUnloadAsync();
                const uri = newRecording.getURI();
                setRecording(null);
                if (uri) {
                  uploadMedia(uri, 'audio', 'none');
                }
              } catch (err) {}
            }
          }
        ]);
      } else {
        Alert.alert("Permission Denied", "Microphone access is required.");
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const recordVideo = async (cameraType: 'front' | 'back') => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      const audioPermissionResult = await Audio.requestPermissionsAsync();
      
      if (!permissionResult.granted || audioPermissionResult.status !== 'granted') {
        Alert.alert("Permission Required", "Camera and Microphone permissions are required for hidden video!");
        return;
      }
      
      setAvrModalVisible(false);
      setHiddenCameraType(cameraType);
      setIsHiddenVideoRecording(true);
      
      setTimeout(async () => {
        try {
          Alert.alert("Recording Started", `Hidden Video (${cameraType}) is recording in background... Press Stop when done.`, [
            { 
              text: "Stop Recording", 
              onPress: async () => {
                if (hiddenCameraRef.current) {
                  hiddenCameraRef.current.stopRecording();
                  setIsHiddenVideoRecording(false);
                }
              }
            }
          ]);
          
          if (hiddenCameraRef.current) {
            const video = await hiddenCameraRef.current.recordAsync();
            if (video && video.uri) {
              uploadMedia(video.uri, 'video', cameraType);
            }
          }
        } catch (e) {
          console.error(e);
          setIsHiddenVideoRecording(false);
        }
      }, 1000);

    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error?.message || "Could not start hidden video");
      setIsHiddenVideoRecording(false);
    }
  };

  const pickImage = async (sectionId: string, title: string, source: 'camera' | 'gallery') => {
    setActiveSectionId(sectionId);
    try {
      let locationText = '';
      if (source === 'camera') {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert("Permission Required", "Camera permission is required!");
          return;
        }
        const locPerm = await ExpoLocation.requestForegroundPermissionsAsync();
        if (locPerm.granted) {
          try {
            const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
            locationText = `Lat: ${loc.coords.latitude.toFixed(6)}, Lng: ${loc.coords.longitude.toFixed(6)} | ${new Date().toLocaleString()}`;
          } catch(e) {}
        }
      } else {
        const galPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galPerm.granted) {
          Alert.alert("Permission Required", "Gallery permission is required!");
          return;
        }
      }

      let capturedImages: string[] = [];

      const captureAndProcess = async () => {
        let result;
        if (source === 'camera') {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7});
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.7});
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
          result.assets.forEach(asset => capturedImages.push(asset.uri));
          
          if (source === 'camera') {
            Alert.alert("Take another?", "Do you want to scan another photo?", [
              { text: "No, Finish", onPress: () => finalizePDF() },
              { text: "Yes", onPress: () => captureAndProcess() }
            ]);
          } else {
            finalizePDF();
          }
        } else if (capturedImages.length > 0) {
           finalizePDF();
        }
      };

      const finalizePDF = async () => {
        if (capturedImages.length === 0) return;
        
        setIsProcessing(true);
        setProcessingMessage("Generating PDF preview...");
        
        const html = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
              <style>
                body { margin: 0; padding: 15px; font-family: -apple-system, sans-serif; background-color: #f1f5f9; display: flex; flex-direction: column; align-items: center; }
                .card { position: relative; width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; margin-bottom: 20px; }
                img { width: 100%; display: block; height: auto; max-height: 70vh; object-fit: contain; background: #000; }
                .overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.85); color: #fff; padding: 12px; font-size: 11px; text-align: left; font-family: monospace; }
                .title { font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #3B82F6; font-family: sans-serif; }
              </style>
            </head>
            <body>
              ${capturedImages.map(uri => `
                <div class="card">
                  <img src="${uri}" />
                  ${locationText ? `
                    <div class="overlay">
                      <div class="title">📍 GPS LOCATION</div>
                      ${locationText}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </body>
          </html>
        `;

        setTempPdfData({
          sectionId: sectionId,
          cameraType: 'none',
          source: source === 'camera' ? 'scan' : 'gallery'
        });
        setPreviewImages(capturedImages);
        setPreviewLocationText(locationText);
        setPreviewAddress('');
        setPreviewHtml(html);
        setPreviewType('scan');
        setPreviewModalVisible(true);
        setIsProcessing(false);
      };

      await captureAndProcess();

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not complete the action");
    }
  };

  // Open case state
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [locationLocked, setLocationLocked] = useState(false);
  const [vaultUploading, setVaultUploading] = useState(false);
  const [vaultUploaded, setVaultUploaded] = useState(false);

  const steps = [
    { title: 'Doc', icon: 'document-text' },
    { title: 'Hosp', icon: 'business' },
    { title: 'Path', icon: 'flask' },
    { title: 'Pat', icon: 'person' },
    { title: 'Other', icon: 'apps' }
  ];

  const getSectionsForStep = (stepTitle: string) => {
    switch(stepTitle) {
      case 'Hosp': return ['gps', 'infra', 'icp', 'verify', 'doc_stmt'];
      case 'Path': return ['path_simple', 'path_stmt', 'path_reg', 'path_lab_reg', 'path_gps_pic'];
      case 'Pat': return ['pat_gps', 'pat_stmt', 'pat_photo'];
      case 'Other': return ['other_photos'];
      default: return [];
    }
  };

  const isStepFullyUploaded = (stepTitle: string) => {
    const stepSections = getSectionsForStep(stepTitle);
    if (stepSections.length === 0) return false;
    return stepSections.every(id => completedSections[id]);
  };

  const isSectionFullyUploaded = (sectionId: string) => {
    const images = uploadedImages[sectionId];
    if (!images) return false;
    return (images.gallery?.length > 0) && (images.scan?.length > 0) && (images.gps?.length > 0);
  };

  const handleCaptureLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLocationLocked(true);
    }, 1000);
  };

  const handleVaultUpload = () => {
    if (!locationLocked) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setVaultUploading(true);
    
    setTimeout(() => {
      setVaultUploading(false);
      setVaultUploaded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      setTimeout(() => {
        setCompletedSteps(prev => prev.includes(activeStep) ? prev : [...prev, activeStep]);
        if (activeStep < steps.length - 1) {
          setActiveStep(prev => prev + 1);
          setLocationLocked(false);
          setVaultUploaded(false);
        }
      }, 1000);
    }, 2000);
  };

  const renderOpenCase = () => (
    <>
      <View style={styles.stepperContainer}>
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isActive = index === activeStep;
          return (
            <Pressable key={index} style={styles.stepWrapper} onPress={() => {
              Haptics.selectionAsync().catch(()=>{});
              setActiveStep(index);
            }}>
              <View style={[
                styles.stepCircle,
                isCompleted && styles.stepCompleted,
                isActive && styles.stepActive
              ]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                ) : (
                  <Ionicons name={step.icon as any} size={16} color={isActive ? "#5F35C7" : "#64748B"} />
                )}
              </View>
              <Text style={[styles.stepTitle, isActive && { color: '#1F2937' }, isCompleted && { color: '#10B981' }]}>
                {step.title}
              </Text>
              {index < steps.length - 1 && (
                <View style={[styles.stepLine, isCompleted && { backgroundColor: '#10B981' }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeStep === 0 ? (
          <View style={styles.verificationCard}>
            <Text style={styles.cardTitle}>Case Documents</Text>
            <Text style={styles.cardSubtitle}>Files fetched from backend for {caseId}</Text>
            
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Available Files</Text>
              <FlatList
                data={caseDocuments}
                keyExtractor={item => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item: doc }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Ionicons name="document-text" size={32} color="#EF4444" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: '#1F2937' }}>{doc.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>PDF Document</Text>
                    </View>
                    <Pressable onPress={() => handleDownload(doc.url)} style={{ padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8 }}>
                      <Ionicons name="download-outline" size={20} color="#3B82F6" />
                    </Pressable>
                  </View>
                )}
              />
            </View>

            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Authorised Letters</Text>
              <FlatList
                data={authLetters}
                keyExtractor={item => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item: letter }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Ionicons name="shield-checkmark" size={32} color="#10B981" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: '#1F2937' }}>{letter.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>Verified PDF</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => handleShare(letter.title, letter.url)} style={{ padding: 8, backgroundColor: '#F0FDF4', borderRadius: 8 }}>
                        <Ionicons name="share-social-outline" size={20} color="#10B981" />
                      </Pressable>
                      <Pressable onPress={() => handleDownload(letter.url)} style={{ padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8 }}>
                        <Ionicons name="download-outline" size={20} color="#3B82F6" />
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            </View>
          </View>
        ) : activeStep === 1 ? (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Hospital Verification</Text>
            
            {[
              { id: 'gps', title: 'Hospital GPS Photo', subtitle: 'Hospital exterior photo with location' },
              { id: 'infra', title: 'Infra Photos', subtitle: 'Infrastructure and facilities' },
              { id: 'icp', title: 'ICP Photos', subtitle: 'Indoor case papers' },
              { id: 'verify', title: 'Verify Photos', subtitle: 'Verification documents' },
              { id: 'doc_stmt', title: 'Doctor Statements', subtitle: 'Written or recorded statements' },
            ].map(section => (
              <View key={section.id} style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="business" size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{section.title}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{section.subtitle}</Text>
                  </View>
                  {isSectionFullyUploaded(section.id) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#34D399', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}>
                      <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', marginLeft: 4 }}>UPLOADED</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderTopRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8 }} onPress={() => pickImage(section.id, section.title, 'gallery')}>
                      <Ionicons name="image" size={14} color="#64748B" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#475569' }}>Gallery</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gallery?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E2E8F0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gallery')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', borderTopRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8 }} onPress={() => openScanCamera(section.id)}>
                      <Ionicons name="scan" size={14} color="#10B981" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#059669' }}>Scan</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.scan?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderLeftWidth: 0, borderColor: '#A7F3D0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'scan')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', borderTopRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8 }} onPress={() => openLiveCamera(section.id)}>
                      <Ionicons name="location" size={14} color="#3B82F6" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>Live GPS</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gps?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderLeftWidth: 0, borderColor: '#BFDBFE', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gps')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 18, borderWidth: 1, borderColor: '#FECACA' }} onPress={() => openAvrMenu(section.id)}>
                      <Ionicons name="videocam" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : steps[activeStep].title === 'Other' ? (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Other Registrations</Text>
            {[
              { id: 'other_photos', title: 'Many Photos', subtitle: 'Capture multiple additional photos' },
            ].map(section => (
              <View key={section.id} style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="document-text" size={20} color="#9333EA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{section.title}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{section.subtitle}</Text>
                  </View>
                  {isSectionFullyUploaded(section.id) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#34D399', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}>
                      <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', marginLeft: 4 }}>UPLOADED</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderTopRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8 }} onPress={() => pickImage(section.id, section.title, 'gallery')}>
                      <Ionicons name="image" size={14} color="#64748B" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#475569' }}>Gallery</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gallery?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E2E8F0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gallery')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', borderTopRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8 }} onPress={() => openScanCamera(section.id)}>
                      <Ionicons name="scan" size={14} color="#10B981" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#059669' }}>Scan</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.scan?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderLeftWidth: 0, borderColor: '#A7F3D0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'scan')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', borderTopRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8 }} onPress={() => openLiveCamera(section.id)}>
                      <Ionicons name="location" size={14} color="#3B82F6" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>Live GPS</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gps?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderLeftWidth: 0, borderColor: '#BFDBFE', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gps')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 18, borderWidth: 1, borderColor: '#FECACA' }} onPress={() => openAvrMenu(section.id)}>
                      <Ionicons name="videocam" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {/* Submit Case Button */}
            <Pressable 
              onPress={handleSubmitCase}
              style={{ marginTop: 24, backgroundColor: '#5F35C7', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              <Ionicons name="lock-closed" size={20} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Submit & Close Case</Text>
            </Pressable>
          </View>
        ) : steps[activeStep].title === 'Pat' ? (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Patient Verification</Text>
            
            {[
              { id: 'pat_gps', title: 'Patient House GPS Photos', subtitle: 'House exterior photo with location' },
              { id: 'pat_stmt', title: 'Patient Statement', subtitle: 'Written or recorded statements' },
              { id: 'pat_photo', title: 'Patient Photo', subtitle: 'Patient identification' },
            ].map(section => (
              <View key={section.id} style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="person" size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{section.title}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{section.subtitle}</Text>
                  </View>
                  {isSectionFullyUploaded(section.id) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#34D399', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}>
                      <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', marginLeft: 4 }}>UPLOADED</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderTopRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8 }} onPress={() => pickImage(section.id, section.title, 'gallery')}>
                      <Ionicons name="image" size={14} color="#64748B" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#475569' }}>Gallery</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gallery?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E2E8F0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gallery')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', borderTopRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8 }} onPress={() => openScanCamera(section.id)}>
                      <Ionicons name="scan" size={14} color="#10B981" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#059669' }}>Scan</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.scan?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderLeftWidth: 0, borderColor: '#A7F3D0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'scan')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', borderTopRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8 }} onPress={() => openLiveCamera(section.id)}>
                      <Ionicons name="location" size={14} color="#3B82F6" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>Live GPS</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gps?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderLeftWidth: 0, borderColor: '#BFDBFE', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gps')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 18, borderWidth: 1, borderColor: '#FECACA' }} onPress={() => openAvrMenu(section.id)}>
                      <Ionicons name="videocam" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : steps[activeStep].title === 'Path' ? (
          <View style={{ paddingBottom: 20 }}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Pathology Verification</Text>
            
            {[
              { id: 'path_simple', title: 'Simple Record', subtitle: 'General pathology records' },
              { id: 'path_stmt', title: 'Pathology / Pathologist Statement', subtitle: 'Written or recorded statements' },
              { id: 'path_reg', title: 'Pathology & Pathologist Registration', subtitle: 'Registration and license details' },
              { id: 'path_lab_reg', title: 'Lab Register', subtitle: 'Laboratory registration and details' },
              { id: 'path_gps_pic', title: 'GPS Picture Labs', subtitle: 'Lab photos with GPS location' },
            ].map(section => (
              <View key={section.id} style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="flask" size={20} color="#9333EA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{section.title}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{section.subtitle}</Text>
                  </View>
                  {isSectionFullyUploaded(section.id) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#34D399', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}>
                      <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', marginLeft: 4 }}>UPLOADED</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderTopRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gallery?.length ? 0 : 8 }} onPress={() => pickImage(section.id, section.title, 'gallery')}>
                      <Ionicons name="image" size={14} color="#64748B" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#475569' }}>Gallery</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gallery?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E2E8F0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gallery')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', borderTopRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.scan?.length ? 0 : 8 }} onPress={() => openScanCamera(section.id)}>
                      <Ionicons name="scan" size={14} color="#10B981" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#059669' }}>Scan</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.scan?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderLeftWidth: 0, borderColor: '#A7F3D0', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'scan')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                    <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', borderTopRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8, borderBottomRightRadius: uploadedImages[section.id]?.gps?.length ? 0 : 8 }} onPress={() => openLiveCamera(section.id)}>
                      <Ionicons name="location" size={14} color="#3B82F6" />
                      <Text style={{ marginLeft: 2, fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>Live GPS</Text>
                    </Pressable>
                    {uploadedImages[section.id]?.gps?.length > 0 && (
                      <Pressable style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderLeftWidth: 0, borderColor: '#BFDBFE', borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => openReviewModal(section.id, 'gps')}>
                        <Ionicons name="eye" size={14} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 18, borderWidth: 1, borderColor: '#FECACA' }} onPress={() => openAvrMenu(section.id)}>
                      <Ionicons name="videocam" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.verificationCard}>
            <Text style={styles.cardTitle}>{steps[activeStep].title} Verification</Text>
            <Text style={styles.cardSubtitle}>Complete mandatory checks to proceed</Text>

            <View style={styles.checkItem}>
              <View style={styles.checkIconBox}>
                <Ionicons name={locationLocked ? "checkmark-circle" : "location"} size={24} color={locationLocked ? "#10B981" : "#EF4444"} />
              </View>
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>GPS Coordinates</Text>
                {locationLocked ? (
                  <Text style={styles.checkValue}>28.6139° N, 77.2090° E</Text>
                ) : (
                  <Text style={styles.checkPending}>Pending Lock</Text>
                )}
              </View>
              {!locationLocked && (
                <Pressable style={styles.actionBtn} onPress={handleCaptureLocation}>
                  <Text style={styles.actionBtnText}>Capture</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.checkItem}>
              <View style={styles.checkIconBox}>
                <Ionicons name={vaultUploaded ? "checkmark-circle" : "folder-open"} size={24} color={vaultUploaded ? "#10B981" : (locationLocked ? "#F59E0B" : "#64748B")} />
              </View>
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Evidence Vault</Text>
                {vaultUploaded ? (
                  <Text style={styles.checkValue}>Encrypted & Synced</Text>
                ) : (
                  <Text style={[styles.checkPending, !locationLocked && {color: '#64748B'}]}>
                    {vaultUploading ? "Compressing..." : "Pending Upload"}
                  </Text>
                )}
              </View>
              {!vaultUploaded && (
                <Pressable 
                  style={[styles.actionBtn, !locationLocked && styles.actionBtnDisabled]} 
                  onPress={handleVaultUpload}
                  disabled={!locationLocked || vaultUploading}
                >
                  {vaultUploading ? (
                    <Ionicons name="sync" size={16} color="#FFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Vault It</Text>
                  )}
                </Pressable>
              )}
            </View>

          </View>
        )}
      </ScrollView>
    </>
  );

  const ALL_SECTIONS = [
    { id: 'gps', title: 'Hospital GPS Photo', group: 'Hospital' },
    { id: 'infra', title: 'Infra Photos', group: 'Hospital' },
    { id: 'icp', title: 'ICP Photos', group: 'Hospital' },
    { id: 'verify', title: 'Verify Photos', group: 'Hospital' },
    { id: 'doc_stmt', title: 'Doctor Statements', group: 'Hospital' },
    { id: 'pat_gps', title: 'Patient House GPS', group: 'Patient' },
    { id: 'pat_stmt', title: 'Patient Statement', group: 'Patient' },
    { id: 'pat_photo', title: 'Patient Photo', group: 'Patient' },
    { id: 'path_simple', title: 'Pathology Record', group: 'Pathology' },
    { id: 'path_stmt', title: 'Pathologist Statement', group: 'Pathology' },
    { id: 'path_reg', title: 'Pathology Reg', group: 'Pathology' },
    { id: 'path_lab_reg', title: 'Lab Register', group: 'Pathology' },
    { id: 'path_gps_pic', title: 'GPS Picture Labs', group: 'Pathology' },
    { id: 'other_photos', title: 'Other Photos', group: 'Other' },
  ];

  const handleSubmitCase = () => {
    const missing = ALL_SECTIONS.filter(sec => !completedSections[sec.id]);
    
    if (missing.length > 0) {
      const missingText = missing.map(m => `• ${m.title} (${m.group})`).join('\n');
      Alert.alert(
        "Missing Documents",
        `You cannot submit the case yet. The following documents are missing:\n\n${missingText}`,
        [{ text: "OK", style: "cancel" }]
      );
    } else {
      setActiveTab('closed');
    }
  };

  const renderClosedCase = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.closedCard}>
        <View style={styles.closedIconWrapper}>
          <Ionicons name="checkmark-done-circle" size={80} color="#10B981" />
        </View>
        <Text style={styles.closedTitle}>Case Closed</Text>
        <Text style={styles.closedSubtitle}>All verifications and mandatory checks for {caseId} have been completed and synced securely.</Text>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Final Summary</Text>
          
          <View style={styles.summaryItem}>
            <Ionicons name="location" size={20} color="#64748B" style={styles.summaryIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Final GPS Coordinates</Text>
              <Text style={styles.summaryValue}>28.6139° N, 77.2090° E</Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <Ionicons name="folder-open" size={20} color="#64748B" style={styles.summaryIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Vault Status</Text>
              <Text style={styles.summaryValue}>All evidence Encrypted & Synced</Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <Ionicons name="calendar" size={20} color="#64748B" style={styles.summaryIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Assigned Date</Text>
              <Text style={styles.summaryValue}>Mon Jun 29 2026</Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <Ionicons name="time" size={20} color="#64748B" style={styles.summaryIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Closure Date</Text>
              <Text style={styles.summaryValue}>{new Date().toDateString()}</Text>
            </View>
          </View>

          {/* Document Status Checklist */}
          <View style={{ ...styles.summaryItem, marginTop: 16, alignItems: 'flex-start' }}>
            <Ionicons name="document-text" size={20} color="#64748B" style={styles.summaryIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Documents Checklist</Text>
              
              <View style={{ marginTop: 8, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                {ALL_SECTIONS.map((sec, index) => {
                  const isDone = completedSections[sec.id];
                  return (
                    <View key={sec.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#F1F5F9' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{sec.title}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{sec.group}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDone ? '#D1FAE5' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Ionicons name={isDone ? "checkmark-circle" : "close-circle"} size={12} color={isDone ? "#059669" : "#DC2626"} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isDone ? "#059669" : "#DC2626", marginLeft: 4 }}>
                          {isDone ? 'UPLOADED' : 'MISSING'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Non-blocking Processing Spinner (Fixed: Removed Modal to prevent UI freeze) */}
      {isProcessing && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 9999 }]}>
          <View style={{ backgroundColor: '#FFF', padding: 24, borderRadius: 16, alignItems: 'center', minWidth: 200, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }}>
            <ActivityIndicator size="large" color="#5F35C7" />
            <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'center' }}>{processingMessage}</Text>
          </View>
        </View>
      )}

      {/* HTML Document Preview Modal */}
      <Modal visible={previewModalVisible} animationType="slide" onRequestClose={handleCancelPreview}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937' }}>
              {previewType === 'gps' ? 'Live GPS Photo Preview' : 'Document Preview'}
            </Text>
            <Pressable onPress={handleCancelPreview} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          {/* Native Image Container */}
          <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
              {previewImages.map((uri, index) => (
                <View key={index} style={{ position: 'relative', width: '100%', maxWidth: 500, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: previewImages.length > 1 ? 16 : 0, borderWidth: 1, borderColor: '#334155' }}>
                  <Image source={{ uri }} style={{ width: '100%', height: 450, resizeMode: 'contain' }} />
                  
                  {previewType === 'gps' ? (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#10B981', marginBottom: 4 }}>📍 LIVE GPS CAPTURE</Text>
                      {previewAddress ? <Text style={{ color: '#FFF', fontSize: 12, marginBottom: 4 }}>{previewAddress}</Text> : null}
                      <Text style={{ color: '#CBD5E1', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 }}>{previewLocationText}</Text>
                      <Text style={{ color: '#CBD5E1', fontSize: 11, fontFamily: 'monospace' }}>{new Date().toLocaleString()}</Text>
                    </View>
                  ) : (
                    previewLocationText ? (
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: 10 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 11, color: '#3B82F6', marginBottom: 2 }}>📍 GPS LOCATION</Text>
                        <Text style={{ color: '#CBD5E1', fontSize: 10, fontFamily: 'monospace' }}>{previewLocationText}</Text>
                      </View>
                    ) : null
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Action Footer */}
          <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFF' }}>
            {isReviewMode ? (
              <Pressable
                onPress={handleCancelPreview}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#5F35C7', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Close Review</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={handleCancelPreview}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', backgroundColor: '#F8FAFC' }}
                >
                  <Text style={{ color: '#475569', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmUpload}
                  style={{ flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: '#5F35C7', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Confirm & Upload</Text>
                </Pressable>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      {/* Hidden Camera for Background Video Recording */}
      {isHiddenVideoRecording && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', zIndex: -1 }}>
          <CameraView 
            ref={hiddenCameraRef}
            style={{ width: 10, height: 10 }}
            facing={hiddenCameraType}
            mode="video"
          />
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Case Workspace</Text>
        <Text style={styles.caseId}>{caseId}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'open' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync().catch(()=>{});
            setActiveTab('open');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'open' && styles.tabTextActive]}>Open Case</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.tabButton, activeTab === 'closed' && styles.tabButtonActive]}
          onPress={() => {
            Haptics.selectionAsync().catch(()=>{});
            setActiveTab('closed');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'closed' && styles.tabTextActive]}>Closed Case</Text>
        </Pressable>
      </View>

      {activeTab === 'open' ? renderOpenCase() : renderClosedCase()}

      <Modal visible={avrModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.avrModalContent}>
            <Text style={styles.modalTitle}>AVR Recording Options</Text>
            <Text style={styles.modalSubtitle}>Select recording mode for this section</Text>

            <View style={styles.avrOptionsRow}>
              <Pressable style={styles.avrOptionBtn} onPress={startAudioRecording}>
                <View style={[styles.avrIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="mic" size={24} color="#9333EA" />
                </View>
                <Text style={styles.avrOptionText}>Record{'\n'}Audio</Text>
              </Pressable>

              <Pressable style={styles.avrOptionBtn} onPress={() => recordVideo('front')}>
                <View style={[styles.avrIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="camera-reverse" size={24} color="#0284C7" />
                </View>
                <Text style={styles.avrOptionText}>Video{'\n'}(Front)</Text>
              </Pressable>

              <Pressable style={styles.avrOptionBtn} onPress={() => recordVideo('back')}>
                <View style={[styles.avrIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="camera" size={24} color="#059669" />
                </View>
                <Text style={styles.avrOptionText}>Video{'\n'}(Back)</Text>
              </Pressable>
            </View>

            <Pressable style={styles.modalCloseBtn} onPress={() => setAvrModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Live GPS Camera Modal */}
      <Modal visible={liveCameraVisible} transparent={false} animationType="slide" onRequestClose={() => setLiveCameraVisible(false)}>
        <View style={{flex: 1, backgroundColor: '#000'}}>
          {liveCameraVisible && (
            <>
              <CameraView ref={liveCameraRef} style={StyleSheet.absoluteFillObject} facing={liveCameraType} />
              <View style={StyleSheet.absoluteFillObject}>
                {/* Top Controls */}
                <View style={{position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20}}>
                  <Pressable onPress={() => setLiveCameraVisible(false)} style={{padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20}}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </Pressable>
                  <Pressable onPress={() => setLiveCameraType(prev => prev === 'back' ? 'front' : 'back')} style={{padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20}}>
                    <Ionicons name="camera-reverse" size={24} color="#FFF" />
                  </Pressable>
                </View>

                {/* GPS Overlay Preview */}
                <View style={{position: 'absolute', bottom: 130, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, borderRadius: 12}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                    <Ionicons name="location" size={20} color="#10B981" style={{marginRight: 8}} />
                    <Text style={{color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1}}>{currentAddress || 'Locating...'}</Text>
                  </View>
                  <Text style={{color: '#E2E8F0', fontSize: 14, marginBottom: 4, fontFamily: 'monospace'}}>
                    Lat: {liveCameraLocation?.coords?.latitude?.toFixed(6) || '--'} | Lng: {liveCameraLocation?.coords?.longitude?.toFixed(6) || '--'}
                  </Text>
                  <Text style={{color: '#E2E8F0', fontSize: 14, fontFamily: 'monospace'}}>
                    {new Date().toLocaleString()}
                  </Text>
                  {liveCameraLocation?.coords?.speed !== null && liveCameraLocation?.coords?.speed !== undefined && liveCameraLocation?.coords?.speed >= 0 && (
                    <Text style={{color: '#E2E8F0', fontSize: 14, fontFamily: 'monospace', marginTop: 4}}>
                      Speed: {(liveCameraLocation?.coords?.speed * 3.6).toFixed(1)} km/h
                    </Text>
                  )}
                </View>

                {/* Bottom Capture Bar */}
                <View style={{position: 'absolute', bottom: 0, width: '100%', height: 110, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                  <Pressable onPress={captureLivePhoto} style={{width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFF', borderWidth: 4, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center'}}>
                    <View style={{width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#000'}} />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Document Scanner Camera Modal */}
      <Modal visible={scanCameraVisible} transparent={false} animationType="slide" onRequestClose={() => finishScanning()}>
        <View style={{flex: 1, backgroundColor: '#000'}}>
          {scanCameraVisible && (
            <>
              <CameraView ref={scanCameraRef} style={StyleSheet.absoluteFillObject} facing="back" enableTorch={scanTorchEnabled} />
              <View style={StyleSheet.absoluteFillObject}>
                
                {/* Grid Overlay */}
                {scanGridVisible && (
                  <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none', zIndex: 1 }]}>
                    <View style={{flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)'}} />
                    <View style={{flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)'}} />
                    <View style={{flex: 1}} />
                    <View style={{position: 'absolute', top: 0, bottom: 0, left: '33.33%', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.4)'}} />
                    <View style={{position: 'absolute', top: 0, bottom: 0, left: '66.66%', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.4)'}} />
                  </View>
                )}

                {/* Top Controls */}
                <View style={{position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10}}>
                  <Pressable onPress={() => finishScanning()} style={{padding: 10}}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                  </Pressable>
                  <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
                    <Pressable onPress={() => setScanTorchEnabled(!scanTorchEnabled)} style={{padding: 5}}>
                      <Ionicons name={scanTorchEnabled ? "flash" : "flash-off"} size={26} color={scanTorchEnabled ? "#F59E0B" : "#FFF"} />
                    </Pressable>
                    <Pressable onPress={() => setScanGridVisible(!scanGridVisible)} style={{padding: 5}}>
                      <Ionicons name={scanGridVisible ? "grid" : "grid-outline"} size={26} color={scanGridVisible ? "#3B82F6" : "#FFF"} />
                    </Pressable>
                    <Pressable onPress={() => { setScanCameraVisible(false); setScanReviewVisible(false); }} style={{padding: 5}}>
                      <Ionicons name="close" size={32} color="#FFF" />
                    </Pressable>
                  </View>
                </View>

                {/* Center Overlay / Reticle */}
                <View style={{position: 'absolute', top: '30%', left: '10%', right: '10%', height: '40%', borderWidth: 2, borderColor: 'rgba(59, 130, 246, 0.5)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
                  <View style={{width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#3B82F6', borderStyle: 'dashed'}} />
                </View>

                {/* Bottom Controls Area */}
                <View style={{position: 'absolute', bottom: 0, width: '100%', height: 160, backgroundColor: 'rgba(0,0,0,0.8)'}}>
                  
                  {/* Mode Selector */}
                  <View style={{flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333'}}>
                    {['Document'].map(mode => (
                      <Text key={mode} style={{color: '#3B82F6', fontSize: 13, fontWeight: 'bold'}}>
                        {mode}
                      </Text>
                    ))}
                  </View>

                  {/* Shutter Row */}
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, flex: 1}}>
                    
                    {/* Left: Gallery/Stack preview */}
                    {scannedImages.length > 0 ? (
                      <Pressable onPress={() => setScanGalleryVisible(true)} style={{width: 60, height: 60, justifyContent: 'center', alignItems: 'center'}}>
                        <View style={{width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
                          <View style={{position: 'absolute', top: -4, right: -4, backgroundColor: '#3B82F6', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 10}}>
                            <Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>{scannedImages.length}</Text>
                          </View>
                          <Image source={{uri: scannedImages[scannedImages.length - 1]}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
                        </View>
                      </Pressable>
                    ) : (
                      <View style={{width: 60, height: 60, justifyContent: 'center', alignItems: 'center'}}>
                        <Ionicons name="images" size={30} color="#FFF" />
                      </View>
                    )}

                    {/* Center: Shutter Button */}
                    <Pressable onPress={captureScanPhoto} style={{alignItems: 'center'}}>
                      <View style={{width: 76, height: 76, borderRadius: 38, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#1E3A8A'}}>
                        <Ionicons name="camera" size={32} color="#FFF" />
                      </View>
                    </Pressable>

                    {/* Right: Checkmark (Finish) */}
                    <View style={{width: 60, height: 60, justifyContent: 'center', alignItems: 'center'}}>
                      {scannedImages.length > 0 && (
                        <Pressable onPress={finishScanning} style={{width: 50, height: 50, borderRadius: 25, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center'}}>
                          <Ionicons name="checkmark" size={40} color="#FFF" />
                        </Pressable>
                      )}
                    </View>

                  </View>
                </View>

              </View>

              {/* Scanned Images Gallery Overlay */}
              {scanGalleryVisible && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 100 }]}>
                  <View style={{position: 'absolute', top: 50, right: 20, zIndex: 110}}>
                    <Pressable onPress={() => setScanGalleryVisible(false)} style={{padding: 10}}>
                      <Ionicons name="close" size={32} color="#FFF" />
                    </Pressable>
                  </View>
                  <ScrollView horizontal pagingEnabled style={{flex: 1}} contentContainerStyle={{alignItems: 'center'}}>
                    {scannedImages.map((uri, index) => (
                      <View key={index} style={{width, height: '80%', justifyContent: 'center', alignItems: 'center', marginTop: 100}}>
                        <Image source={{uri}} style={{width: '90%', height: '100%', resizeMode: 'contain', borderRadius: 12, borderWidth: 1, borderColor: '#333'}} />
                        <Text style={{color: '#FFF', marginTop: 20, fontSize: 16, fontWeight: 'bold'}}>{index + 1} of {scannedImages.length}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Scanned Images Review Overlay */}
              {scanReviewVisible && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#F8FAFC', zIndex: 200 }]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0'}}>
                    <Pressable onPress={() => setScanReviewVisible(false)} style={{padding: 5}}>
                      <Ionicons name="arrow-back" size={28} color="#1F2937" />
                    </Pressable>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1F2937'}}>Review Scans</Text>
                    <Pressable onPress={() => { setScanCameraVisible(false); setScanReviewVisible(false); }} style={{padding: 5}}>
                      <Ionicons name="close" size={28} color="#EF4444" />
                    </Pressable>
                  </View>
                  <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 100}}>
                    {scannedImages.map((uri, index) => (
                      <View key={index} style={{marginBottom: 20, alignItems: 'center', backgroundColor: '#FFF', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0'}}>
                        <Text style={{fontWeight: '700', marginBottom: 12, color: '#1F2937'}}>Page {index + 1}</Text>
                        <Image source={{uri}} style={{width: '100%', height: 400, resizeMode: 'contain', backgroundColor: '#F1F5F9', borderRadius: 8}} />
                      </View>
                    ))}
                  </ScrollView>
                  <View style={{position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0'}}>
                    <Pressable onPress={generatePdfFromScans} style={{backgroundColor: '#5F35C7', paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10}}>
                      <Ionicons name="document-text" size={24} color="#FFF" />
                      <Text style={{color: '#FFF', fontSize: 16, fontWeight: '800'}}>Convert to PDF</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  caseId: { fontSize: 14, color: '#5F35C7', fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  
  tabContainer: { flexDirection: 'row', padding: 8, paddingHorizontal: 24, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabButtonActive: { backgroundColor: '#F0F5FA' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#5F35C7', fontWeight: '800' },

  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  stepWrapper: { alignItems: 'center', position: 'relative' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', zIndex: 2 },
  stepActive: { borderColor: '#5F35C7', backgroundColor: 'rgba(95, 53, 199, 0.1)' },
  stepCompleted: { borderColor: '#10B981', backgroundColor: '#10B981' },
  stepTitle: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 8 },
  stepLine: { position: 'absolute', top: 18, left: 36, width: 30, height: 2, backgroundColor: '#E2E8F0', zIndex: 1 },

  scrollContent: { padding: 24, paddingBottom: 100 },
  
  verificationCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 24 },

  checkItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  checkIconBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkContent: { flex: 1 },
  checkLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  checkValue: { fontSize: 12, color: '#64748B' },
  checkPending: { fontSize: 12, color: '#F59E0B', fontWeight: '500' },
  
  actionBtn: { backgroundColor: '#5F35C7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnDisabled: { backgroundColor: '#94A3B8' },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  closedCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 12 },
  closedIconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  closedTitle: { fontSize: 22, fontWeight: '900', color: '#1F2937', marginBottom: 8 },
  closedSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 32 },

  summaryContainer: { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 16 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  summaryIcon: { marginRight: 16, backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  avrModalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 24, textAlign: 'center' },
  avrOptionsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 24 },
  avrOptionBtn: { alignItems: 'center', flex: 1 },
  avrIconBox: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avrOptionText: { fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' },
  modalCloseBtn: { width: '100%', paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' },
  modalCloseText: { fontSize: 14, fontWeight: '700', color: '#64748B' }});
