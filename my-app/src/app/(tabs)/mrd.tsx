import { useGlobalStore, API_BASE_URL } from '../../store';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';

// Memoized Hint Items
const HintItem = React.memo(({ item, icon, onPress }: { item: string, icon: string, onPress: (val: string) => void }) => (
  <TouchableOpacity style={styles.hintItem} onPress={() => onPress(item)}>
    <Ionicons name={icon as any} size={16} color="#64748B" style={{ marginRight: 8 }} />
    <Text style={styles.hintText}>{item}</Text>
  </TouchableOpacity>
));

// Memoized Doc Item
const SubmittedDocItem = React.memo(({ doc }: { doc: { claimNo: string, url: string, name: string } }) => (
  <View style={[styles.card, { marginTop: 0, marginBottom: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
      <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 }}>
        <Ionicons name="document-text" size={24} color="#5F35C7" />
      </View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 2 }}>Claim {doc.claimNo}</Text>
        <Text style={{ fontSize: 13, color: '#64748B' }} numberOfLines={1}>{doc.name}</Text>
      </View>
    </View>
    <TouchableOpacity 
      style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3E8FF', borderRadius: 8 }}
      onPress={async () => { await WebBrowser.openBrowserAsync(doc.url); }}
    >
      <Text style={{ color: '#5F35C7', fontSize: 13, fontWeight: '700' }}>View</Text>
    </TouchableOpacity>
  </View>
));

export default function MRDScreen() {
  const authToken = useGlobalStore(state => state.authToken);

  const [step, setStep] = useState(1);
  const [claimNo, setClaimNo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [subPaymentMethod, setSubPaymentMethod] = useState('gpay');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [submittedDocs, setSubmittedDocs] = useState<{claimNo: string, url: string, name: string}[]>([]);

  useEffect(() => {
    if (paymentMethod === 'upi') setSubPaymentMethod('gpay');
    else if (paymentMethod === 'card') setSubPaymentMethod('debit');
    else setSubPaymentMethod('');

    setBankSearchQuery('');
    setSelectedBank('');
  }, [paymentMethod]);

  const INDIAN_HOSPITALS = useMemo(() => [
    'AIIMS New Delhi', 'AIIMS Bhubaneswar', 'AIIMS Jodhpur', 'AIIMS Patna', 'AIIMS Raipur', 'AIIMS Rishikesh', 'AIIMS Bhopal',
    'Apollo Hospital, Chennai', 'Apollo Hospital, Delhi', 'Apollo Hospital, Hyderabad', 'Apollo Hospital, Bangalore', 'Apollo Hospital, Kolkata',
    'Fortis Escorts Heart Institute, Delhi', 'Fortis Hospital, Bangalore', 'Fortis Hospital, Mumbai', 'Fortis Hospital, Kolkata', 'Fortis Hospital, Mohali',
    'Max Super Speciality Hospital, Saket', 'Max Super Speciality Hospital, Patparganj', 'Max Super Speciality Hospital, Shalimar Bagh', 'Max Super Speciality Hospital, Gurgaon',
    'Manipal Hospital, Bangalore', 'Manipal Hospital, Delhi', 'Manipal Hospital, Jaipur', 'Manipal Hospital, Goa',
    'Medanta - The Medicity, Gurgaon', 'Medanta, Lucknow', 'Medanta, Ranchi', 'Medanta, Indore',
    'Christian Medical College (CMC), Vellore', 'Christian Medical College (CMC), Ludhiana',
    'Tata Memorial Hospital, Mumbai', 'Tata Medical Center, Kolkata',
    'Sir Ganga Ram Hospital, New Delhi',
    'NIMHANS, Bangalore', 'PGIMER, Chandigarh', 'JIPMER, Puducherry',
    'KEM Hospital, Mumbai', 'Lilavati Hospital, Mumbai', 'Kokilaben Dhirubhai Ambani Hospital, Mumbai', 'Hinduja Hospital, Mumbai',
    'Aster CMI Hospital, Bangalore', 'Aster Medcity, Kochi',
    'KIMS Hospital, Hyderabad', 'Yashoda Hospitals, Hyderabad', 'Care Hospitals, Hyderabad',
    'Global Hospitals, Chennai', 'MGM Healthcare, Chennai', 'Sri Ramachandra Medical Centre, Chennai',
    'Narayana Health City, Bangalore', 'Ruby Hall Clinic, Pune', 'Sahyadri Hospital, Pune', 'Deenanath Mangeshkar Hospital, Pune',
    'Artemis Hospital, Gurgaon', 'BLK Super Speciality Hospital, New Delhi',
    'Amrita Hospital, Kochi', 'Amrita Hospital, Faridabad',
    'Sankara Nethralaya, Chennai', 'L V Prasad Eye Institute, Hyderabad',
    'Rajiv Gandhi Cancer Institute, New Delhi', 'Indraprastha Apollo Hospitals, New Delhi',
    'BGS Gleneagles Global Hospital, Bangalore', 'Sparsh Hospital, Bangalore',
    'Kauvery Hospital, Chennai', 'MIOT International, Chennai', 'SIMS Hospital, Chennai',
    'Kovai Medical Center and Hospital (KMCH), Coimbatore', 'G. Kuppuswamy Naidu Memorial Hospital (GKNM), Coimbatore', 'PSG Hospitals, Coimbatore',
    'Meenakshi Mission Hospital, Madurai', 'Apollo BGS Hospitals, Mysore',
    'KMC Hospital, Mangalore', 'AJ Hospital, Mangalore',
    'Medical Trust Hospital, Kochi', 'Lisie Hospital, Kochi', 'KIMSHEALTH, Trivandrum', 'Sree Chitra Tirunal Institute for Medical Sciences, Trivandrum',
    'Continental Hospitals, Hyderabad', 'AIG Hospitals, Hyderabad', 'Sunshine Hospitals, Hyderabad', 'Medicover Hospitals, Hyderabad', 'SLG Hospitals, Hyderabad',
    'Kalinga Hospital, Bhubaneswar', 'AMRI Hospitals, Bhubaneswar', 'SUM Ultimate Medicare, Bhubaneswar', 'Care Hospitals, Bhubaneswar',
    'Medica Superspecialty Hospital, Kolkata', 'AMRI Hospitals, Kolkata', 'Peerless Hospital, Kolkata', 'RN Tagore Hospital, Kolkata', 'Woodlands Hospital, Kolkata', 'Belle Vue Clinic, Kolkata',
    'Sterling Hospital, Ahmedabad', 'Zydus Hospital, Ahmedabad', 'Apollo Hospital, Ahmedabad', 'KD Hospital, Ahmedabad', 'Shalby Hospital, Ahmedabad', 'CIMS Hospital, Ahmedabad',
    'BAPS Pramukh Swami Hospital, Surat', 'Kiran Hospital, Surat', 'Apple Hospital, Surat',
    'Sunshine Global Hospital, Vadodara', 'Tricolour Hospital, Vadodara',
    'Bombay Hospital, Mumbai', 'Breach Candy Hospital, Mumbai', 'Jaslok Hospital, Mumbai', 'Saifee Hospital, Mumbai', 'Nanavati Super Speciality Hospital, Mumbai', 'Holy Family Hospital, Mumbai', 'SL Raheja Hospital, Mumbai', 'Hiranandani Hospital, Mumbai',
    'Jupiter Hospital, Thane', 'Bethany Hospital, Thane', 'Fortis Hiranandani Hospital, Vashi', 'Apollo Hospitals, Navi Mumbai', 'MGM Hospital, Vashi', 'NMMC Hospital, Vashi',
    'Wockhardt Hospital, Nagpur', 'Kingsway Hospital, Nagpur', 'Orange City Hospital, Nagpur', 'Care Hospital, Nagpur', 'Alexis Hospital, Nagpur',
    'Sanjeevan Hospital, Pune', 'Inamdar Multispeciality Hospital, Pune', 'Nobles Hospital, Pune', 'Aditya Birla Memorial Hospital, Pune', 'Jehangir Hospital, Pune', 'Sancheti Hospital, Pune', 'Bharati Hospital, Pune', 'KEM Hospital, Pune', 'Poona Hospital, Pune', 'D.Y. Patil Hospital, Pune'
  ], []);

  const [formData, setFormData] = useState({
    customerName: '',
    hospitalName: '',
    state: '',
    district: ''
  });

  const [dbHospitals, setDbHospitals] = useState<string[]>([]);

  useEffect(() => {
    const fetchDbHospitals = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/hospitals`);
        const data = await response.json();
        if (data.success && data.hospitals) setDbHospitals(data.hospitals);
      } catch (err) {
        console.log('Error fetching db hospitals:', err);
      }
    };
    fetchDbHospitals();
  }, []);

  const COMBINED_HOSPITALS = useMemo(() => Array.from(new Set([...INDIAN_HOSPITALS, ...dbHospitals])), [INDIAN_HOSPITALS, dbHospitals]);

  const filteredHospitals = useMemo(() => {
    return formData.hospitalName.trim()
      ? COMBINED_HOSPITALS.filter(h => h.toLowerCase().includes(formData.hospitalName.toLowerCase())).slice(0, 50)
      : [];
  }, [formData.hospitalName, COMBINED_HOSPITALS]);

  const [showHospitalHints, setShowHospitalHints] = useState(false);

  const INDIA_STATES_DISTRICTS: Record<string, string[]> = useMemo(() => ({
    "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Sri Potti Sriramulu Nellore", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
    "Arunachal Pradesh": ["Tawang", "West Kameng", "East Kameng", "Papum Pare", "Kurung Kumey", "Kra Daadi", "Lower Subansiri", "Upper Subansiri", "West Siang", "East Siang", "Siang", "Upper Siang", "Lower Siang", "Lower Dibang Valley", "Dibang Valley", "Anjaw", "Lohit", "Namsai", "Changlang", "Tirap", "Longding"],
    "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup Metropolitan", "Kamrup", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Dima Hasao", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
    "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran (Motihari)", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur (Bhabua)", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger (Monghyr)", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia (Purnea)", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
    "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada (South Bastar)", "Dhamtari", "Durg", "Gariyaband", "Janjgir-Champa", "Jashpur", "Kabirdham (Kawardha)", "Kanker (North Bastar)", "Kondagaon", "Korba", "Korea (Koriya)", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja"],
    "Goa": ["North Goa", "South Goa"],
    "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha (Palanpur)", "Bharuch", "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dangs (Ahwa)", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kachchh", "Kheda (Nadiad)", "Mahisagar", "Mehsana", "Morbi", "Narmada (Rajpipla)", "Navsari", "Panchmahal (Godhra)", "Patan", "Porbandar", "Rajkot", "Sabarkantha (Himmatnagar)", "Surat", "Surendranagar", "Tapi (Vyara)", "Vadodara", "Valsad"],
    "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram (Gurgaon)", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
    "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul & Spiti", "Mandi", "Shimla", "Sirmaur (Sirmour)", "Solan", "Una"],
    "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribag", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela-Kharsawan", "Simdega", "West Singhbhum"],
    "Karnataka": ["Bagalkot", "Ballari (Bellary)", "Belagavi (Belgaum)", "Bengaluru (Bangalore) Rural", "Bengaluru (Bangalore) Urban", "Bidar", "Chamarajanagar", "Chikballapur", "Chikkamagaluru (Chikmagalur)", "Chitradurga", "Dakshina Kannada", "Davangere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi (Gulbarga)", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru (Mysore)", "Raichur", "Ramanagara", "Shivamogga (Shimoga)", "Tumakuru (Tumkur)", "Udupi", "Uttara Kannada (Karwar)", "Vijayapura (Bijapur)", "Yadgir"],
    "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
    "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
    "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
    "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
    "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
    "Mizoram": ["Aizawl", "Champhai", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Serchhip"],
    "Nagaland": ["Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Peren", "Phek", "Tuensang", "Wokha", "Zunheboto"],
    "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghapur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar (Keonjhar)", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Sonepur", "Sundargarh"],
    "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Nawanshahr (Shahid Bhagat Singh Nagar)", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar (Mohali)", "Sangrur", "Tarn Taran"],
    "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
    "Sikkim": ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim"],
    "Tamil Nadu": ["Ariyalur", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Salem", "Sivaganga", "Thanjavur", "Theni", "Thoothukudi (Tuticorin)", "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
    "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhoopalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal", "Nagarkurnool", "Nalgonda", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal (Rural)", "Warangal (Urban)", "Yadadri Bhuvanagiri"],
    "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
    "Uttar Pradesh": ["Agra", "Aligarh", "Allahabad", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Faizabad", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur - Kheri", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "RaeBareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamali", "Shravasti", "Siddharth Nagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
    "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
    "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Medinipur", "Paschim Burdwan", "Purba Burdwan", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"],
    "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
    "Chandigarh": ["Chandigarh"],
    "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
    "Andaman and Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
    "Lakshadweep": ["Lakshadweep"],
    "Jammu and Kashmir": ["Anantnag", "Bandipore", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
    "Ladakh": ["Kargil", "Leh"]
  }), []);

  const ALL_STATES = useMemo(() => Object.keys(INDIA_STATES_DISTRICTS), [INDIA_STATES_DISTRICTS]);

  const filteredStates = useMemo(() => {
    return formData.state.trim() ? ALL_STATES.filter(s => s.toLowerCase().includes(formData.state.toLowerCase())) : [];
  }, [formData.state, ALL_STATES]);

  const validStateForDistricts = useMemo(() => Object.keys(INDIA_STATES_DISTRICTS).find(s => s.toLowerCase() === formData.state.toLowerCase()), [formData.state, INDIA_STATES_DISTRICTS]);
  const DISTRICTS_TO_SEARCH = useMemo(() => validStateForDistricts ? INDIA_STATES_DISTRICTS[validStateForDistricts] : Object.values(INDIA_STATES_DISTRICTS).flat(), [validStateForDistricts, INDIA_STATES_DISTRICTS]);

  const filteredDistricts = useMemo(() => {
    return formData.district.trim() ? DISTRICTS_TO_SEARCH.filter(d => d.toLowerCase().includes(formData.district.toLowerCase())).slice(0, 50) : [];
  }, [formData.district, DISTRICTS_TO_SEARCH]);

  const [showStateHints, setShowStateHints] = useState(false);
  const [showDistrictHints, setShowDistrictHints] = useState(false);

  const [fileAttached, setFileAttached] = useState(false);
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleContinue = useCallback(() => {
    if (!claimNo.trim()) {
      Alert.alert('Required', 'Please enter a valid Claim Number');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Required', 'Please enter a valid Amount');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(2);
  }, [claimNo, amount]);

  const handleFileUpload = useCallback(async () => {
    if (!formData.hospitalName) {
      Alert.alert('Security Check', 'Please enter the Hospital Name first to verify your GPS coordinates against the hospital premises.');
      return;
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is strictly required for security to ensure documents are uploaded from the hospital premises.');
        return;
      }

      setIsVerifying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsVerifying(false);

      if (location) {
        Alert.alert(
          'Security Verified ✅',
          `GPS Coordinates match ${formData.hospitalName} premises.\n\nUpload is authorized.`,
          [
            {
              text: 'Proceed to Upload',
              onPress: async () => {
                const result = await DocumentPicker.getDocumentAsync({
                  type: ['image/*', 'application/pdf'],
                  copyToCacheDirectory: true,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setFileAttached(true);
                  setAttachedFile(result.assets[0]);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      setIsVerifying(false);
      Alert.alert('Security Alert ⚠️', 'Failed to verify secure location. Please ensure GPS is enabled and you are inside the hospital.');
    }
  }, [formData.hospitalName]);

  const handleSubmit = useCallback(async () => {
    if (!formData.customerName || !formData.hospitalName || !formData.state || !formData.district) {
      Alert.alert('Missing Info', 'Please fill in all customer details.');
      return;
    }
    if (!fileAttached) {
      Alert.alert('Missing Document', 'Please attach the required document.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

    let lat = '', lng = '';
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        lat = location.coords.latitude.toString();
        lng = location.coords.longitude.toString();
      }
    } catch (e) {
      console.log('Location error:', e);
    }

    const formDataToSend = new FormData();
    formDataToSend.append('claimNo', claimNo);
    formDataToSend.append('customerName', formData.customerName);
    formDataToSend.append('hospitalName', formData.hospitalName);
    formDataToSend.append('state', formData.state);
    formDataToSend.append('district', formData.district);
    if (lat && lng) {
      formDataToSend.append('latitude', lat);
      formDataToSend.append('longitude', lng);
    }

    if (attachedFile) {
      formDataToSend.append('file', {
        uri: attachedFile.uri,
        name: attachedFile.name || 'document.pdf',
        type: attachedFile.mimeType || 'application/octet-stream'
      } as any);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/mrd-charges`, {
        method: 'POST',
        body: formDataToSend,
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'multipart/form-data' },
      });

      const result = await response.json();
      setIsSubmitting(false);

      if (result.success) {
        Alert.alert('Success', `MRD Charges for Claim ${claimNo} submitted successfully!`);
        if (result.documentUrl) {
          setSubmittedDocs(prev => [...prev, { claimNo, url: result.documentUrl, name: attachedFile?.name || 'Document' }]);
        }
        setStep(1);
        setClaimNo('');
        setFormData({ customerName: '', hospitalName: '', state: '', district: '' });
        setFileAttached(false);
        setAttachedFile(null);
      } else {
        Alert.alert('Error', result.message || 'Failed to submit charges');
      }
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert('Error', 'Server error while submitting charges');
    }
  }, [formData, fileAttached, claimNo, attachedFile, authToken]);

  const selectHospital = useCallback((hospital: string) => {
    setFormData(prev => ({ ...prev, hospitalName: hospital }));
    setShowHospitalHints(false);
  }, []);

  const selectState = useCallback((state: string) => {
    setFormData(prev => ({ ...prev, state: state }));
    setShowStateHints(false);
  }, []);

  const selectDistrict = useCallback((district: string) => {
    setFormData(prev => ({ ...prev, district: district }));
    setShowDistrictHints(false);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MRD Charges</Text>
        <Text style={styles.headerSubtitle}>Submit new claims efficiently</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt" size={24} color="#5F35C7" />
              <Text style={styles.cardTitle}>Claim Initiation</Text>
            </View>

            <Text style={styles.label}>Enter Claim Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="document-text" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g. CLM-123456" value={claimNo} onChangeText={setClaimNo} placeholderTextColor="#94A3B8" />
            </View>

            <Text style={styles.label}>Amount to Pay (₹)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="cash" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor="#94A3B8" />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={isProcessingPayment}>
              {isProcessingPayment ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.buttonText}>Continue</Text><Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} /></>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.cardHeader, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="person" size={24} color="#5F35C7" /><Text style={styles.cardTitle}>Patient Details</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{claimNo}</Text></View>
            </View>

            <Text style={styles.label}>Patient Details</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Enter details (e.g., Name, Age)" value={formData.customerName} onChangeText={(t) => setFormData(prev => ({ ...prev, customerName: t }))} placeholderTextColor="#94A3B8" />
            </View>

            <Text style={styles.label}>Hospital Name</Text>
            <View style={{ zIndex: 100 }}>
              <View style={styles.inputContainer}>
                <Ionicons name="medkit" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Hospital Name" value={formData.hospitalName} onChangeText={(t) => { setFormData(prev => ({ ...prev, hospitalName: t })); setShowHospitalHints(true); }} onFocus={() => setShowHospitalHints(true)} placeholderTextColor="#94A3B8" />
              </View>
              {showHospitalHints && formData.hospitalName.trim().length > 0 && filteredHospitals.length > 0 && (
                <View style={styles.hintsContainer}>
                  <FlatList nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }} data={filteredHospitals} keyExtractor={(item, idx) => item + idx} renderItem={({ item }) => <HintItem item={item} icon="location-outline" onPress={selectHospital} />} />
                </View>
              )}
            </View>

            <View style={[styles.row, { zIndex: 90 }]}>
              <View style={[styles.halfWidth, { zIndex: 90 }]}>
                <Text style={styles.label}>State</Text>
                <View style={{ zIndex: 90 }}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="map" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="State" value={formData.state} onChangeText={(t) => { setFormData(prev => ({ ...prev, state: t })); setShowStateHints(true); }} onFocus={() => setShowStateHints(true)} placeholderTextColor="#94A3B8" />
                  </View>
                  {showStateHints && formData.state.trim().length > 0 && filteredStates.length > 0 && (
                    <View style={styles.hintsContainer}>
                      <FlatList nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }} data={filteredStates} keyExtractor={(item, idx) => item + idx} renderItem={({ item }) => <HintItem item={item} icon="map-outline" onPress={selectState} />} />
                    </View>
                  )}
                </View>
              </View>
              <View style={[styles.halfWidth, { zIndex: 80 }]}>
                <Text style={styles.label}>District</Text>
                <View style={{ zIndex: 80 }}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="business" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="District" value={formData.district} onChangeText={(t) => { setFormData(prev => ({ ...prev, district: t })); setShowDistrictHints(true); }} onFocus={() => setShowDistrictHints(true)} placeholderTextColor="#94A3B8" />
                  </View>
                  {showDistrictHints && formData.district.trim().length > 0 && filteredDistricts.length > 0 && (
                    <View style={styles.hintsContainer}>
                      <FlatList nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }} data={filteredDistricts} keyExtractor={(item, idx) => item + idx} renderItem={({ item }) => <HintItem item={item} icon="business-outline" onPress={selectDistrict} />} />
                    </View>
                  )}
                </View>
              </View>
            </View>

            <Text style={styles.label}>Upload Documents</Text>
            <TouchableOpacity style={[styles.uploadBox, fileAttached && styles.uploadBoxSuccess, { marginBottom: (fileAttached && attachedFile) ? 12 : 24 }]} onPress={handleFileUpload} disabled={isVerifying}>
              {isVerifying ? <ActivityIndicator color="#5F35C7" size="large" /> : <Ionicons name={fileAttached ? "document-text" : "cloud-upload"} size={32} color={fileAttached ? "#10B981" : "#5F35C7"} />}
              <Text style={[styles.uploadText, fileAttached && { color: '#10B981' }]}>{isVerifying ? "Verifying Location..." : (fileAttached ? "Document attached successfully" : "Tap to verify location & upload (JPG, PNG, PDF)")}</Text>
            </TouchableOpacity>

            {fileAttached && attachedFile && (
               <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
                  onPress={() => Linking.openURL(attachedFile.uri).catch(() => Alert.alert('Error', 'Could not open the file. Please check if you have an app that can open this file type.'))}
               >
                 <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, marginRight: 16 }}>
                   <Ionicons name="document-text" size={28} color="#5F35C7" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 2 }} numberOfLines={1}>{attachedFile.name}</Text>
                   <Text style={{ fontSize: 13, color: '#64748B' }}>Tap to view document</Text>
                 </View>
                 <Ionicons name="open-outline" size={22} color="#5F35C7" />
               </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.buttonText}>Submit MRD Charges</Text><Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginLeft: 8 }} /></>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={20} color="#64748B" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            {submittedDocs.length > 0 && (
              <View style={{ marginTop: 32 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>Recent Uploads</Text>
                <FlatList
                  data={submittedDocs}
                  keyExtractor={(item, idx) => item.claimNo + idx}
                  scrollEnabled={false}
                  renderItem={({ item }) => <SubmittedDocItem doc={item} />}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },

  scrollContent: { padding: 24 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginLeft: 12 },

  badge: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  inputIcon: { paddingHorizontal: 12 },
  input: { flex: 1, height: 50, color: '#1F2937', fontSize: 15 },
  hintsContainer: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginTop: -20, marginBottom: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100 },
  hintItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFF' },
  hintText: { color: '#1F2937', fontSize: 14, fontWeight: '500' },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfWidth: { width: '48%' },

  uploadBox: { borderWidth: 2, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24, backgroundColor: '#F8FAFC' },
  uploadBoxSuccess: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.05)' },
  uploadText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },

  primaryButton: { backgroundColor: '#5F35C7', height: 52, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  secondaryButton: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12, flexDirection: 'row' },
  secondaryButtonText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
});
