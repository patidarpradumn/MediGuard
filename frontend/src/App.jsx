import React, { useState, useEffect } from 'react';

// Backend URL resolution
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const INDIAN_STATES = [
  "Andaman & Nicobar", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

function OpenStreetMapComponent({ doctorSpecialist, language }) {
  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersGroupRef = React.useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  
  const [searchCity, setSearchCity] = useState('');
  const [searchState, setSearchState] = useState('');
  const [searchSpecialist, setSearchSpecialist] = useState(doctorSpecialist || '');
  const [foundClinics, setFoundClinics] = useState([]);

  useEffect(() => {
    if (doctorSpecialist) {
      const docLower = doctorSpecialist.toLowerCase();
      if (docLower.includes("gastro")) {
        setSearchSpecialist("Gastroenterologist");
      } else if (docLower.includes("ophthalmologist") || docLower.includes("eye") || docLower.includes("vision")) {
        setSearchSpecialist("Ophthalmologist");
      } else if (docLower.includes("cardio") || docLower.includes("heart")) {
        setSearchSpecialist("Cardiologist");
      } else if (docLower.includes("dentist") || docLower.includes("dental")) {
        setSearchSpecialist("Dentist");
      } else if (docLower.includes("pediatric") || docLower.includes("paediatric") || docLower.includes("child") || docLower.includes("kids")) {
        setSearchSpecialist("Pediatrician");
      } else if (docLower.includes("derma") || docLower.includes("skin")) {
        setSearchSpecialist("Dermatologist");
      } else if (docLower.includes("gyneco") || docLower.includes("gynaeco") || docLower.includes("women") || docLower.includes("obstet")) {
        setSearchSpecialist("Gynecologist");
      } else if (docLower.includes("ortho")) {
        setSearchSpecialist("Orthopedic");
      } else if (docLower.includes("neuro")) {
        setSearchSpecialist("Neurologist");
      } else if (docLower.includes("general") || docLower.includes("physician") || docLower.includes("geriatric") || docLower.includes("medical")) {
        setSearchSpecialist("General");
      } else {
        setSearchSpecialist("");
      }
    } else {
      setSearchSpecialist("");
    }
  }, [doctorSpecialist]);

  const fetchNearbyHospitals = async (lat, lon, map, specialist, userLoc = null) => {
    const L = window.L;
    if (!L) return;
    setLoading(true);
    setErrorMsg('');

    // Specialty keyword matching helper
    const matchesSpecialty = (el) => {
      if (!specialist) return true;
      const spec = specialist.toLowerCase();
      
      const keywordsMap = {
        general: ["general", "physician", "medicine", "clinic", "hospital", "health", "doctor"],
        cardiologist: ["cardio", "heart", "cardiologist", "cardiology"],
        dentist: ["dentist", "dental", "tooth", "teeth", "orthodontist"],
        pediatrician: ["pediatric", "paediatric", "child", "kids", "children", "pediatrician"],
        dermatologist: ["skin", "derma", "dermatologist", "dermatology", "laser"],
        gynecologist: ["gyneco", "gynaeco", "gynecologist", "women", "maternity", "obstetrics", "gynae"],
        orthopedic: ["ortho", "bone", "joint", "orthopedic", "orthopaedic", "fracture"],
        neurologist: ["neuro", "brain", "spine", "neurologist", "neurology", "nerve"],
        gastroenterologist: ["gastro", "stomach", "gastroenterologist", "gastroenterology", "abdomen", "digestive"],
        ophthalmologist: ["eye", "ophthalmologist", "ophthalmology", "vision", "optometry", "optic"]
      };

      const keywords = keywordsMap[spec] || [spec];
      
      const name = (el.tags?.name || "").toLowerCase();
      const amenity = (el.tags?.amenity || "").toLowerCase();
      const healthcare = (el.tags?.healthcare || "").toLowerCase();
      const specialityTag = (el.tags?.speciality || "").toLowerCase();
      const healthcareSpec = (el.tags?.["healthcare:speciality"] || "").toLowerCase();
      const description = (el.tags?.description || "").toLowerCase();
      
      return keywords.some(kw => 
        name.includes(kw) ||
        amenity.includes(kw) ||
        healthcare.includes(kw) ||
        specialityTag.includes(kw) ||
        healthcareSpec.includes(kw) ||
        description.includes(kw)
      );
    };
    
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }
    
    const activeUserLoc = userLoc || userLocation;
    if (activeUserLoc) {
      const isDefault = activeUserLoc[0] === 28.6139 && activeUserLoc[1] === 77.2090;
      const popupText = isDefault ? "<b>Default Location (Delhi)</b>" : "<b>You are here</b>";
      
      L.marker(activeUserLoc, {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: `<div style="background-color: #0e7490; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(14, 116, 144, 0.8);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(markersGroupRef.current)
        .bindPopup(popupText)
        .openPopup();
    }

    try {
      const response = await fetch(`${BACKEND_URL}/map/hospitals?lat=${lat}&lon=${lon}`);

      if (!response.ok) throw new Error("Failed to query backend proxy.");

      const data = await response.json();
      let elements = data.elements || [];

      // Strictly filter elements based on recommended/selected specialty
      if (specialist) {
        elements = elements.filter(el => matchesSpecialty(el));
      }

      if (elements.length === 0) {
        setFoundClinics([]);
        setErrorMsg(`No nearby ${specialist || 'medical'} clinics or doctors found matching this specialty.`);
        setLoading(false);
        return;
      }

      const formattedClinics = [];

      elements.forEach((el) => {
        const itemLat = el.lat || (el.center && el.center.lat);
        const itemLon = el.lon || (el.center && el.center.lon);
        if (itemLat && itemLon) {
          const name = el.tags?.name || `${specialist || 'Medical'} Center`;
          const address = el.tags?.["addr:street"] || el.tags?.["addr:suburb"] || el.tags?.["addr:city"] || "Nearby Medical Center";
          const phoneNum = el.tags?.phone || el.tags?.["contact:phone"] || "";
          const isHospital = (el.tags?.amenity === "hospital" || el.tags?.healthcare === "hospital");
          const website = el.tags?.website || "";

          // Check if this item is a strict specialty match vs a general hospital
          const getStrictMatch = () => {
            if (!specialist) return false;
            const spec = specialist.toLowerCase();
            const keywordsMap = {
              general: ["general", "physician", "medicine", "clinic", "hospital", "health", "doctor"],
              cardiologist: ["cardio", "heart", "cardiologist", "cardiology"],
              dentist: ["dentist", "dental", "tooth", "teeth", "orthodontist"],
              pediatrician: ["pediatric", "paediatric", "child", "kids", "children", "pediatrician"],
              dermatologist: ["skin", "derma", "dermatologist", "dermatology", "laser"],
              gynecologist: ["gyneco", "gynaeco", "gynecologist", "women", "maternity", "obstetrics", "gynae"],
              orthopedic: ["ortho", "bone", "joint", "orthopedic", "orthopaedic", "fracture"],
              neurologist: ["neuro", "brain", "spine", "neurologist", "neurology", "nerve"],
              gastroenterologist: ["gastro", "stomach", "gastroenterologist", "gastroenterology", "abdomen", "digestive"],
              ophthalmologist: ["eye", "ophthalmologist", "ophthalmology", "vision", "optometry", "optic"]
            };
            const keywords = keywordsMap[spec] || [spec];
            const nameLower = name.toLowerCase();
            const specialityTag = (el.tags?.speciality || "").toLowerCase();
            const healthcareSpec = (el.tags?.["healthcare:speciality"] || "").toLowerCase();
            const descLower = (el.tags?.description || "").toLowerCase();
            const amenityLower = (el.tags?.amenity || "").toLowerCase();
            
            // General hospitals count as generic treatment locations, not strict specialty matches
            // unless they specifically advertise that department in name or tags
            if (isHospital && !keywords.some(kw => nameLower.includes(kw) || specialityTag.includes(kw) || healthcareSpec.includes(kw))) {
              return false;
            }

            return keywords.some(kw => 
              nameLower.includes(kw) ||
              amenityLower.includes(kw) ||
              specialityTag.includes(kw) ||
              healthcareSpec.includes(kw) ||
              descLower.includes(kw)
            );
          };

          const isStrict = getStrictMatch();
          let specKey = "General";
          if (specialist === "Cardiologist") specKey = "Cardio";
          else if (specialist === "Dentist") specKey = "Dentist";
          else if (specialist === "Pediatrician") specKey = "Pediatrician";
          else if (specialist === "Dermatologist") specKey = "Dermatologist";
          else if (specialist === "Gynecologist") specKey = "Gynecologist";
          else if (specialist === "Orthopedic") specKey = "Orthopedic";
          else if (specialist === "Neurologist") specKey = "Neurologist";
          else if (specialist === "Gastroenterologist") specKey = "Gastro";
          else if (specialist === "Ophthalmologist") specKey = "Ophthal";

          const typeLabel = isStrict 
            ? `${translations[language]["spec" + specKey] || specialist}` 
            : (isHospital ? (translations[language].hospitalMultiSpecialty || "Hospital (Multi-Specialty)") : (el.tags?.amenity || translations[language].medicalCenter || "Medical Center"));

          formattedClinics.push({
            id: el.id,
            name,
            address,
            phoneNum,
            type: typeLabel,
            website,
            lat: itemLat,
            lon: itemLon,
            isStrict
          });

          L.marker([itemLat, itemLon], {
            icon: L.divIcon({
              className: 'hospital-marker-custom',
              html: `<div style="background-color: #e11d48; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 0 8px rgba(225, 29, 72, 0.8);">+</div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })
          })
            .addTo(markersGroupRef.current)
            .bindPopup(`
              <div class="custom-map-popup">
                <h4>🏥 ${name}</h4>
                <div style="font-size:0.65rem; background-color:rgba(14,116,144,0.1); color:#0e7490; font-weight:800; border-radius:4px; padding:0.15rem 0.35rem; display:inline-block; margin-bottom:0.4rem; text-transform:uppercase;">${typeLabel}</div>
                <p>📍 ${address}</p>
                ${phoneNum ? `<p>📞 ${phoneNum}</p>` : ''}
              </div>
            `);
        }
      });

      // Sort: Strict specialty matches first, multi-specialty hospitals second
      if (specialist) {
        formattedClinics.sort((a, b) => {
          if (a.isStrict && !b.isStrict) return -1;
          if (!a.isStrict && b.isStrict) return 1;
          return 0;
        });
      }

      setFoundClinics(formattedClinics);
    } catch (err) {
      console.error("Failed to query OpenStreetMap Overpass API:", err);
      setErrorMsg("Failed to query nearby clinics online.");
      setFoundClinics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.L) {
      setErrorMsg("Leaflet maps library failed to load.");
      return;
    }

    const L = window.L;

    if (!mapInstanceRef.current && mapContainerRef.current) {
      const defaultLatLng = [28.6139, 77.2090];
      
      const map = L.map(mapContainerRef.current).setView(defaultLatLng, 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);

      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const userLatLng = [latitude, longitude];
            setUserLocation(userLatLng);
            map.setView(userLatLng, 14);
          },
          (err) => {
            console.warn("Geolocation permission denied or failed. Fallback to default center.", err);
            const fallbackLatLng = defaultLatLng;
            setUserLocation(fallbackLatLng);
            map.setView(fallbackLatLng, 13);
            setErrorMsg("Could not detect live location (check browser location permission / HTTPS context). Showing default location (Delhi).");
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        const fallbackLatLng = defaultLatLng;
        setUserLocation(fallbackLatLng);
        setErrorMsg("Browser does not support geolocation. Showing default location (Delhi).");
      }

      // Auto-invalidate size to fix grey box layout issues in deployed/transitioning environments
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 500);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && userLocation) {
      fetchNearbyHospitals(userLocation[0], userLocation[1], mapInstanceRef.current, searchSpecialist, userLocation);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }
  }, [searchSpecialist, userLocation]);

  const handleAreaSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchCity && !searchState) {
      setErrorMsg("Please enter at least a city or state to search.");
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    const queryStr = `${searchCity ? searchCity + ', ' : ''}${searchState ? searchState + ', ' : ''}India`;
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1`;
    
    try {
      const geoRes = await fetch(geoUrl, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'MediGuard-AI-Healthcare-Assistant'
        }
      });
      if (!geoRes.ok) throw new Error("Geocoding failed");
      
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        const customLat = parseFloat(geoData[0].lat);
        const customLon = parseFloat(geoData[0].lon);
        const newLoc = [customLat, customLon];
        setUserLocation(newLoc);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(newLoc, 14);
        }
      } else {
        setErrorMsg(`Could not find coordinates for "${queryStr}". Try another city/state name.`);
        setLoading(false);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setErrorMsg("Failed to resolve location coordinates.");
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    setSearchCity('');
    setSearchState('');
    setLoading(true);
    setErrorMsg('');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userLatLng = [latitude, longitude];
          setUserLocation(userLatLng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView(userLatLng, 14);
          }
        },
        (err) => {
          console.warn("Geolocation denied/failed. Falling back to default center.", err);
          const defaultLatLng = [28.6139, 77.2090];
          setUserLocation(defaultLatLng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView(defaultLatLng, 13);
          }
          setErrorMsg("Could not detect live location (using default center).");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      const defaultLatLng = [28.6139, 77.2090];
      setUserLocation(defaultLatLng);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView(defaultLatLng, 13);
      }
      setErrorMsg("Browser does not support geolocation.");
    }
  };

  const handleLocateClinic = (clinic) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([clinic.lat, clinic.lon], 16);
      
      window.L.popup()
        .setLatLng([clinic.lat, clinic.lon])
        .setContent(`
          <div class="custom-map-popup">
            <h4>🏥 ${clinic.name}</h4>
            <p>📍 ${clinic.address}</p>
            ${clinic.phoneNum ? `<p>📞 ${clinic.phoneNum}</p>` : ''}
          </div>
        `)
        .openOn(mapInstanceRef.current);
    }
  };

  return (
    <div className="map-compartment-container">
      <div className="map-search-indicator">
        <span>{translations[language].mapProviderInfo}</span>
        {loading && <span className="animate-pulse">{translations[language].searchingClinics}</span>}
      </div>

      <form onSubmit={handleAreaSearch} className="map-custom-search-form">
        <div className="map-search-grid">
          <div className="map-input-group">
            <label className="map-input-label">{translations[language].stateLabel}</label>
            <select
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              className="map-select-input"
            >
              <option value="">{translations[language].selectState}</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="map-input-group">
            <label className="map-input-label">{translations[language].cityLabel}</label>
            <input
              type="text"
              placeholder="e.g. Mumbai, Indore"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="map-text-input"
            />
          </div>

          <div className="map-input-group">
            <label className="map-input-label">{translations[language].specialistLabel}</label>
            <select
              value={searchSpecialist}
              onChange={(e) => setSearchSpecialist(e.target.value)}
              className="map-select-input"
            >
              <option value="">{translations[language].anySpecialist}</option>
              <option value="General">{translations[language].specGeneral}</option>
              <option value="Cardiologist">{translations[language].specCardio}</option>
              <option value="Dentist">{translations[language].specDentist}</option>
              <option value="Pediatrician">{translations[language].specPediatrician}</option>
              <option value="Dermatologist">{translations[language].specDermatologist}</option>
              <option value="Gynecologist">{translations[language].specGynecologist}</option>
              <option value="Orthopedic">{translations[language].specOrthopedic}</option>
              <option value="Neurologist">{translations[language].specNeurologist}</option>
              <option value="Gastroenterologist">{translations[language].specGastro}</option>
              <option value="Ophthalmologist">{translations[language].specOphthal}</option>
            </select>
          </div>
        </div>

        <div className="map-search-buttons-row">
          <button type="submit" className="map-search-btn">
            {translations[language].searchProvidersBtn}
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="map-gps-btn"
          >
            {translations[language].useGpsBtn}
          </button>
        </div>
      </form>

      <div ref={mapContainerRef} className="leaflet-map-wrapper"></div>

      {errorMsg && <div className="error-alert-3d" style={{ margin: '0.8rem 0 0 0' }}>⚠️ {errorMsg}</div>}

      {foundClinics.length > 0 && (
        <div className="map-clinics-results-panel">
          <div className="results-header-3d">
            <h4>{translations[language].foundProvidersHeader} ({foundClinics.length})</h4>
          </div>
          <div className="map-clinics-list-container">
            {foundClinics.map((clinic) => (
              <div key={clinic.id} className="clinic-card-item">
                <div className="clinic-card-main-info">
                  <h5 className="clinic-card-title">🏥 {clinic.name}</h5>
                  <p className="clinic-card-address">📍 {clinic.address}</p>
                  {clinic.phoneNum && <p className="clinic-card-phone">📞 {clinic.phoneNum}</p>}
                  {clinic.type && <span className="clinic-card-badge">{clinic.type}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleLocateClinic(clinic)}
                  className="clinic-locate-btn"
                >
                  {translations[language].locateBtn}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="map-search-actions">
        <a
          className="mini-map-action-btn"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${searchSpecialist || 'Hospital'} near me`)}`}
        >
          {translations[language].viewFullMapSearch}
        </a>
      </div>
    </div>
  );
}


const translations = {
  en: {
    appName: "MediGuard AI",
    home: "Home",
    dashboard: "Diagnostic Console",
    login: "Log In",
    signup: "Sign Up",
    logout: "Log Out",
    languageLabel: "Language",
    badge: "✓ AI-Powered Symptom Triage & Healthcare Finder",
    heroTitle: "Symptom Analysis & Specialist Doctor Finder",
    heroSubtitle: "Analyze your symptoms, calculate urgency levels based on clinical rules, find nearby specialist hospitals in India on a map, and consult our AI assistant for wellness guidance.",
    initPortal: "Start Diagnostic Portal 🩺",
    consultWellness: "Consult Wellness AI 💬",
    securityTitle: "System Security",
    secureStatus: "SECURE",
    diagProtocol: "DIAGNOSTIC PROTOCOL",
    privateSession: "✓ 100% Private Session",
    dbLifecycle: "DATABASE STORAGE",
    dbClusters: "MongoDB Database Logs",
    servicesHeading: "Our Real Features",
    servicesSubtitle: "A genuine toolkit designed to help you analyze symptoms, locate Indian healthcare facilities, and chat with a wellness assistant.",
    service1Title: "Rule-Based Symptom Analyzer",
    service1Desc: "Input your symptoms, age, and gender. Our system evaluates if it's a Normal, Urgent, or Emergency situation and suggests the correct doctor specialist.",
    service1Tag: "Symptom Triage",
    service2Title: "Wellness AI Chatbot",
    service2Desc: "Chat with our AI wellness assistant to get personalized diet suggestions, recovery tips, and wellness advice based on your diagnostic results.",
    service2Tag: "AI Chat Assistant",
    service3Title: "Hospital & Clinic Map Locator",
    service3Desc: "Search for hospitals and specialist clinics in India by selecting your State and City. Locate them on an interactive map and view direct contact details.",
    service3Tag: "Interactive Maps",
    service4Title: "Saved Diagnosis History",
    service4Desc: "All your past symptom analysis records and triage logs are securely stored in your personal account database for future reference.",
    service4Tag: "MongoDB History",
    service5Title: "Email & OTP Login",
    service5Desc: "Log in securely using your email. A one-time password (OTP) is sent to verify your identity to keep your diagnostic history private.",
    service5Tag: "OTP Verification",
    service6Title: "Medical Report Parser",
    service6Desc: "Upload images or PDF documents of your medical reports in the chatbot. The AI assistant reads the file and provides easy-to-understand wellness insights.",
    service6Tag: "Document Support",
    timelineHeading: "How It Works",
    timelineSubtitle: "Get medical guidance and find nearby doctor facilities in four simple steps.",
    step1Title: "Secure Email Signup",
    step1Desc: "Create an account with your email and verify it using the OTP code sent to your inbox.",
    step2Title: "Enter Symptoms & Details",
    step2Desc: "Provide your symptoms, choose age and gender, or drag and drop a medical report document.",
    step3Title: "View Urgency & Doctor Suggestion",
    step3Desc: "Our rules engine analyzes the inputs and suggests the correct specialist and triage category.",
    step4Title: "Search & Find Clinics",
    step4Desc: "Select your State and City to view matching specialist hospitals directly on the map.",
    ctaTitle: "Start Managing Your Health Logs Today",
    ctaDesc: "Save your symptom history securely in MongoDB and find the right doctors near you in India.",
    ctaButton: "Create Your Account",

    // Login View
    loginTitle: "Portal Access Login",
    loginSubtitle: "Sign in to search symptoms, save diagnosis logs, and coordinate with specialist physicians.",
    emailLabel: "Email Address",
    emailPlaceholder: "Enter registered email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    loginBtn: "Secure Log In",
    loginLoading: "Authenticating...",
    toSignup: "Don't have an account? Sign Up Here",

    // Signup View
    signupTitle: "Create Health Account",
    signupSubtitle: "Register with your email address to initialize a private and personalized diagnostic portal.",
    signupPasswordPlaceholder: "Create password (min 6 characters)",
    signupBtn: "Send Verification OTP",
    signupLoading: "Processing...",
    toLogin: "Already registered? Log In Here",

    // Verify OTP View
    verifyTitle: "Verify Email Address",
    verifySubtitle: "A 4-digit verification code has been sent to your email. Enter it below.",
    otpLabel: "Enter 4-Digit OTP Code",
    verifyBtn: "Verify & Launch Dashboard",
    verifyLoading: "Verifying...",
    resendOtp: "Did not receive code? Resend OTP Code",

    // Dashboard Subtabs
    tabAnalyzer: "🩺 Clinical Analyzer Terminal",
    tabChatbot: "💬 Consult Wellness AI",

    // Clinical Analyzer Terminal
    analyzerTitle: "Clinical Symptom Terminal",
    analyzerSubtitle: "Enter patient demographics and symptoms below. Our rule-based AI engine will analyze risk, suggest specialist doctors, and fetch warning advice.",
    patientAgeLabel: "Patient Age:",
    patientGenderLabel: "Patient Gender",
    genderMale: "👨 Male",
    genderFemale: "👩 Female",
    genderOther: "🧑 Other",
    childAvatar: "Pediatric Child",
    childRange: "Age 0-12 yrs",
    seniorAvatar: "Geriatric Senior",
    seniorRange: "Age 65+ yrs",
    adultAvatar: "General Adult",
    adultRange: "Age 13-64 yrs",
    describeSymptomsLabel: "Describe Patient Symptoms",
    symptomsPlaceholder: "Type details (e.g. experiencing chest congestion, dry cough, runny nose, or minor dental ache)...",
    runEngine: "Run Advisor Engine",
    analyzeBtn: "Analyze Case 🩺",
    analyzingText: "Analyzing...",
    presetsLabel: "Symptom Presets",

    // Result Card
    verdictTitle: "📋 AI Diagnostic Verdict",
    verdictSubtitle: "Based on reported symptoms & demographics",
    riskBadge: "Risk",
    suggestedPhysician: "Suggested Specialty Physician:",
    hotlineLabel: "Hotline & Appointment Scheduling:",
    emergencyWarning: "EMERGENCY WARNING: Seek hospital care immediately.",
    treatmentGuidelines: "Treatment & Home Care Guidelines",
    adviceLabel: "Directives & Advice:",
    homeCareLabel: "Standard Home Care & OTC Guidelines:",

    // History logs
    historyTitle: "Personal Diagnosis History",
    noRecords: "No recent case records found.",
    historyRegisteredText: "Completed logs will register here dynamically.",
    historyLabel: "Symptoms:",
    historySpecialist: "Specialist:",

    // Chatbot Tab
    chatbotTitle: "Clinical Wellness & Diet Agent",
    chatbotSubtitle: "Ask about diet plans, food items to include or avoid, lifestyle changes, and general health tips based on your condition.",
    emptyChatMain: "Start consulting with MediGuard AI Agent",
    emptyChatSub: "Type a query below or select a quick starter prompt. The agent will analyze and suggest healthy guidelines.",
    chatAcidityDiet: "🍋 Diet for Acidity",
    chatFeverDiet: "🍵 Lifestyle for Fever",
    chatWomenDiet: "🤰 Women's Health Diet",
    chatSleepDiet: "💤 Rest & Sleep Guidelines",
    placeholderChat: "Ask Wellness AI about foods, diet or lifestyle advice...",
    placeholderChatLoading: "AI Agent is compiling recommendation...",

    // Footer Disclaimer
    disclaimer: "⚠️ Regulatory Disclaimer: This engine provides advisory specialisation matching and home care OTC references. It does NOT provide diagnostic, medical, or prescription verdicts. For any acute pain or life-threatening situation, alert emergency paramedics (108/112) or reach your closest emergency ward immediately.",
    copyright: "MediGuard AI - Clinical Decision Support Platform",

    // New localization keys
    years: "Years",
    serviceStatusLabel: "Service Status:",
    dbStoreLabel: "Database Store:",
    online: "Online",
    offline: "Offline",
    connected: "Connected",
    disconnected: "Disconnected",
    stateLabel: "State",
    cityLabel: "City",
    specialistLabel: "Specialist Required",
    selectState: "Select State",
    anySpecialist: "Any Specialist / Hospital",
    searchProvidersBtn: "🔍 Search Providers",
    useGpsBtn: "📍 Use My GPS",
    mapProviderInfo: "🗺️ Local Care Map (Powered by OpenStreetMap - Free & No Charges)",
    searchingClinics: "Searching nearest clinics...",
    foundProvidersHeader: "📋 Found Nearby Clinics & Centers",
    locateBtn: "Locate",
    viewFullMapSearch: "View Full OpenStreetMap Search",
    authenticating: "Authenticating...",
    processing: "Processing...",
    verifying: "Verifying...",
    patientAgeFull: "Patient Age:",
    patientGenderFull: "Patient Gender",
    runAdvisorLabel: "Run Advisor Engine",
    diagnosticVerdictTitle: "📋 AI Diagnostic Verdict",
    diagnosticVerdictSub: "Based on reported symptoms & demographics",
    suggestedSpecialistLabel: "Suggested Specialty Physician:",
    hotlineAppointmentLabel: "Hotline & Appointment Scheduling:",
    emergencyWarningText: "EMERGENCY WARNING: Seek hospital care immediately.",
    treatmentGuidelinesLabel: "Treatment & Home Care Guidelines",
    directivesAdviceLabel: "Directives & Advice:",
    standardHomeCareLabel: "Standard Home Care & OTC Guidelines:",
    personalHistoryHeader: "Personal Diagnosis History",
    noCaseRecords: "No recent case records found.",
    completedLogsDesc: "Completed logs will register here dynamically.",
    historySymptomsLabel: "Symptoms:",
    historySpecialistLabel: "Specialist:",
    historyYrs: "yrs",

    active: "Active",
    degraded: "Degraded",
    toSignupLabel: "Don't have an account? ",
    toSignupLink: "Sign Up Here",
    toLoginLabel: "Already registered? ",
    toLoginLink: "Log In Here",
    queryAcidity: "What should I eat when feeling high acidity and heartburn?",
    queryFever: "Can you suggest a diet plan and lifestyle advice for high fever?",
    queryWomen: "What foods should I avoid if I suspect pregnancy menstrual cramps?",
    querySleep: "Can you suggest stress relief and dietary recommendations for insomnia/lack of sleep?",
    chatbotBadge: "Wellness AI",
    uploadedReportLabel: "[Uploaded Report: {fileName}]",
    hospitalMultiSpecialty: "Hospital (Multi-Specialty)",
    specialistSuffix: "Specialist",
    medicalCenter: "Medical Center",
    clinicalVerdictRouting: "Clinical Verdict & Routing",

    // Specialists
    specGeneral: "General Physician",
    specCardio: "Cardiologist (Heart)",
    specDentist: "Dentist (Dental)",
    specPediatrician: "Pediatrician (Kids)",
    specDermatologist: "Dermatologist (Skin)",
    specGynecologist: "Gynecologist (Women)",
    specOrthopedic: "Orthopedic (Bones)",
    specNeurologist: "Neurologist (Brain)",
    specGastro: "Gastroenterologist (Stomach)",
    specOphthal: "Ophthalmologist (Eyes)",

    // Presets
    tagChestPain: "Chest Pain",
    tagFeverCough: "Fever & Cough",
    tagSkinAllergy: "Skin Allergy",
    tagToothache: "Toothache",
    tagEyeBlur: "Eye Blurriness",
    tagStomachAcid: "Stomach Acid",
    tagAnxiety: "Anxiety"
  },
  hi: {
    appName: "मेडीगार्ड AI",
    home: "होम",
    dashboard: "डायग्नोस्टिक कंसोल",
    login: "लॉग इन",
    signup: "साइन अप",
    logout: "लॉग आउट",
    languageLabel: "भाषा",
    badge: "✓ एआई-संचालित लक्षण विश्लेषण और अस्पताल खोजक",
    heroTitle: "एआई संचालित उन्नत स्वास्थ्य निदान एवं विशेषज्ञ मार्गदर्शन",
    heroSubtitle: "अपने स्वास्थ्य का सटीक विश्लेषण करें। क्लिनिकल नियमों पर आधारित हमारी अत्याधुनिक एआई प्रणाली से जोखिम के स्तर की पहचान करें, भारत के शीर्ष विशेषज्ञ अस्पतालों को खोजें, और तुरंत विश्वसनीय स्वास्थ्य सलाह प्राप्त करें।",
    initPortal: "डायग्नोस्टिक पोर्टल शुरू करें 🩺",
    consultWellness: "वेलनेस एआई से परामर्श लें 💬",
    securityTitle: "सिस्टम सुरक्षा",
    secureStatus: "सुरक्षित",
    diagProtocol: "डायग्नोस्टिक प्रोटोकॉल",
    privateSession: "✓ 100% व्यक्तिगत सत्र",
    dbLifecycle: "डेटाबेस स्टोरेज",
    dbClusters: "मोंगोडीबी डेटाबेस लॉग्स",
    servicesHeading: "अत्याधुनिक स्वास्थ्य सुविधाएं",
    servicesSubtitle: "एक प्रीमियम और स्मार्ट प्रणाली जो आपके लक्षणों का सघन विश्लेषण करती है, सर्वश्रेष्ठ अस्पतालों का पता लगाती है, और आपको एक व्यक्तिगत एआई स्वास्थ्य सलाहकार से जोड़ती है।",
    service1Title: "नियम-आधारित लक्षण विश्लेषक",
    service1Desc: "अपने लक्षण, उम्र & लिंग दर्ज करें। हमारा सिस्टम विश्लेषण करेगा कि स्थिति सामान्य (Normal), तत्काल (Urgent) या आपातकालीन (Emergency) है और डॉक्टर सुझाएगा।",
    service1Tag: "लक्षण ट्राइएज",
    service2Title: "वेलनेस एआई चैटबॉट",
    service2Desc: "डाइट प्लान, रिकवरी टिप्स और डायग्नोस्टिक रिपोर्ट के आधार पर स्वास्थ्य सलाह पाने के लिए हमारे एआई चैटबॉट से बात करें।",
    service2Tag: "एआई चैट असिस्टेंट",
    service3Title: "अस्पताल और क्लीनिक मैप खोजक",
    service3Desc: "अपने राज्य और शहर का चयन करके भारत के अस्पताल खोजें। उन्हें नक्शे पर लाइव देखें और संपर्क सूत्र प्राप्त करें।",
    service3Tag: "इंटरएक्टिव मैप्स",
    service4Title: "सुरक्षित निदान इतिहास",
    service4Desc: "आपके पुराने सभी लक्षण विश्लेषण और रिपोर्ट इतिहास को भविष्य के संदर्भ के लिए मोंगोडीबी डेटाबेस में सुरक्षित रखा जाता है।",
    service4Tag: "मोंगोडीबी इतिहास",
    service5Title: "ईमेल और ओटीपी लॉगिन",
    service5Desc: "अपने ईमेल से सुरक्षित लॉगिन करें। पहचान सत्यापित करने और निदान इतिहास को सुरक्षित रखने के लिए एक वन-टाइम पासवर्ड (OTP) भेजा जाता है।",
    service5Tag: "ओटीपी सत्यापन",
    service6Title: "मेडिकल रिपोर्ट विश्लेषक",
    service6Desc: "चैट में अपनी मेडिकल रिपोर्ट की फोटो या पीडीएफ अपलोड करें। एआई असिस्टेंट फाइल को पढ़कर आसान भाषा में सलाह देगा।",
    service6Tag: "दस्तावेज़ सहायता",
    timelineHeading: "प्रणाली की कार्यप्रणाली",
    timelineSubtitle: "चार सरल और सुरक्षित चरणों में अपनी स्वास्थ्य स्थिति का सटीक मूल्यांकन करें और सर्वश्रेष्ठ विशेषज्ञों से जुड़ें।",
    step1Title: "सुरक्षित ईमेल साइनअप",
    step1Desc: "अपने ईमेल के साथ अकाउंट बनाएं और अपने इनबॉक्स में आए ओटीपी कोड से इसे सत्यापित करें।",
    step2Title: "लक्षण और विवरण दर्ज करें",
    step2Desc: "अपने लक्षण लिखें, उम्र और लिंग चुनें, या चैट में मेडिकल रिपोर्ट फ़ाइल अपलोड करें।",
    step3Title: "गंभीरता और डॉक्टर सुझाव देखें",
    step3Desc: "हमारा नियम इंजन विवरणों का विश्लेषण कर सही विशेषज्ञ और स्थिति के स्तर की सलाह दिखाता है।",
    step4Title: "नक्शे पर अस्पताल खोजें",
    step4Desc: "भारत में अपने राज्य और शहर का चयन करें और मैप पर संबंधित विशेषज्ञता वाले अस्पतालों को देखें।",
    ctaTitle: "आज ही अपने स्वास्थ्य को प्राथमिकता दें",
    ctaDesc: "अपने व्यक्तिगत स्वास्थ्य डेटा को उच्चतम सुरक्षा के साथ सहेजें और अपने आस-पास के सर्वश्रेष्ठ विशेषज्ञों से जुड़ें।",
    ctaButton: "अपना खाता बनाएं",

    // Login View
    loginTitle: "पोर्टल एक्सेस लॉगिन",
    loginSubtitle: "लक्षणों का विश्लेषण करने, निदान रिकॉर्ड रखने और विशेषज्ञ डॉक्टरों से परामर्श करने के लिए लॉगिन करें।",
    emailLabel: "ईमेल पता",
    emailPlaceholder: "पंजीकृत ईमेल पता दर्ज करें",
    passwordLabel: "पासवर्ड",
    passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    loginBtn: "सुरक्षित लॉगिन",
    loginLoading: "सत्यापित किया जा रहा है...",
    toSignup: "खाता नहीं है? यहाँ साइन अप करें",

    // Signup View
    signupTitle: "हेल्थ खाता बनाएं",
    signupSubtitle: "एक निजी और कस्टमाइज्ड निदान पोर्टल शुरू करने के लिए अपने ईमेल पते के साथ पंजीकरण करें।",
    signupPasswordPlaceholder: "पासवर्ड बनाएं (कम से कम 6 अक्षर)",
    signupBtn: "सत्यापन कोड (OTP) भेजें",
    signupLoading: "प्रक्रिया जारी है...",
    toLogin: "पहले से पंजीकृत हैं? यहाँ लॉगिन करें",

    // Verify OTP View
    verifyTitle: "ईमेल पता सत्यापित करें",
    verifySubtitle: "आपके ईमेल पर 4-अंकीय सत्यापन कोड भेजा गया है। इसे नीचे दर्ज करें।",
    otpLabel: "4-अंकीय ओटीपी कोड दर्ज करें",
    verifyBtn: "सत्यापित करें और डैशबोर्ड खोलें",
    verifyLoading: "सत्यापन जारी है...",
    resendOtp: "कोड नहीं मिला? ओटीपी कोड दोबारा भेजें",

    // Dashboard Subtabs
    tabAnalyzer: "🩺 क्लिनिकल एनालाइजर टर्मिनल",
    tabChatbot: "💬 वेलनेस एआई सलाहकार",

    // Clinical Analyzer Terminal
    analyzerTitle: "क्लिनिकल लक्षण टर्मिनल",
    analyzerSubtitle: "मरीज के लक्षण और बुनियादी जानकारी दर्ज करें। हमारा एआई जोखिम विश्लेषण करेगा और विशेषज्ञ डॉक्टर सुझाएगा।",
    patientAgeLabel: "मरीज की उम्र:",
    patientGenderLabel: "मरीज का लिंग",
    genderMale: "👨 पुरुष",
    genderFemale: "👩 महिला",
    genderOther: "🧑 अन्य",
    childAvatar: "बाल रोग (बच्चा)",
    childRange: "उम्र 0-12 वर्ष",
    seniorAvatar: "वृद्ध नागरिक",
    seniorRange: "उम्र 65+ वर्ष",
    adultAvatar: "वयस्क सामान्य",
    adultRange: "उम्र 13-64 वर्ष",
    describeSymptomsLabel: "मरीज के लक्षणों का विवरण",
    symptomsPlaceholder: "लक्षण लिखें (जैसे छाती में जकड़न, सूखी खांसी, बहती नाक, या दांत में दर्द)...",
    runEngine: "सलाहकार इंजन चलाएं",
    analyzeBtn: "मामले का विश्लेषण करें 🩺",
    analyzingText: "विश्लेषण जारी है...",
    presetsLabel: "लक्षण प्रीसेट",

    // Result Card
    verdictTitle: "📋 एआई निदान निर्णय",
    verdictSubtitle: "दर्ज किए गए लक्षणों और मरीज की जानकारी के आधार पर",
    riskBadge: "जोखिम",
    suggestedPhysician: "सुझाए गए विशेषज्ञ डॉक्टर:",
    hotlineLabel: "हॉटलाइन और अपॉइंटमेंट शेड्यूलिंग:",
    emergencyWarning: "आपातकालीन चेतावनी: तुरंत अस्पताल में इलाज लें।",
    treatmentGuidelines: "उपचार और घरेलू देखभाल दिशानिर्देश",
    adviceLabel: "निर्देश और सलाह:",
    homeCareLabel: "घरेलू देखभाल और ओवर-द-काउंटर (OTC) दिशानिर्देश:",

    // History logs
    historyTitle: "व्यक्तिगत निदान इतिहास",
    noRecords: "कोई पिछला निदान रिकॉर्ड नहीं मिला।",
    historyRegisteredText: "पूरे किए गए मामले यहां दिखाई देंगे।",
    historyLabel: "लक्षण:",
    historySpecialist: "विशेषज्ञ डॉक्टर:",

    // Chatbot Tab
    chatbotTitle: "क्लिनिकल वेलनेस और डाइट एआई",
    chatbotSubtitle: "अपनी स्वास्थ्य स्थिति के आधार पर डाइट प्लान, खाने योग्य चीजें, जीवनशैली में बदलाव और सामान्य स्वास्थ्य युक्तियाँ पूछें।",
    emptyChatMain: "मेडीगार्ड एआई सलाहकार के साथ बातचीत शुरू करें",
    emptyChatSub: "नीचे एक प्रश्न टाइप करें या एक प्रीसेट सुझाव चुनें। एआई उचित सलाह देगा।",
    chatAcidityDiet: "🍋 एसिडिटी के लिए डाइट",
    chatFeverDiet: "🍵 बुखार के लिए जीवनशैली",
    chatWomenDiet: "🤰 महिला स्वास्थ्य डाइट",
    chatSleepDiet: "💤 आराम और नींद गाइड",
    placeholderChat: "डाइट, भोजन या जीवनशैली के बारे में वेलनेस एआई से पूछें...",
    placeholderChatLoading: "एआई सलाहकार सलाह तैयार कर रहा है...",

    // Footer Disclaimer
    disclaimer: "⚠️ नियामक अस्वीकरण: यह इंजन केवल सलाहकार सुझाव और सामान्य घरेलू देखभाल संदर्भ प्रदान करता है। यह कोई डॉक्टर का पर्चा या अंतिम निदान नहीं है। किसी भी गंभीर दर्द या आपातकालीन स्थिति में तुरंत एम्बुलेंस (108/112) को कॉल करें या नजदीकी अस्पताल जाएं।",
    copyright: "मेडीगार्ड AI - क्लिनिकल डिसीजन सपोर्ट प्लेटफार्म",

    // New localization keys
    years: "वर्ष",
    serviceStatusLabel: "सेवा स्थिति:",
    dbStoreLabel: "डेटाबेस स्टोर:",
    online: "ऑनलाइन",
    offline: "ऑफलाइन",
    connected: "कनेक्टेड",
    disconnected: "डिस्कनेक्टेड",
    stateLabel: "राज्य",
    cityLabel: "शहर",
    specialistLabel: "आवश्यक विशेषज्ञ",
    selectState: "राज्य चुनें",
    anySpecialist: "कोई भी विशेषज्ञ / अस्पताल",
    searchProvidersBtn: "🔍 चिकित्सा केंद्र खोजें",
    useGpsBtn: "📍 मेरा जीपीएस उपयोग करें",
    mapProviderInfo: "🗺️ स्थानीय चिकित्सा मानचित्र (ओपनस्ट्रीटमैप द्वारा संचालित - नि: शुल्क)",
    searchingClinics: "नजदीकी क्लीनिक खोज रहे हैं...",
    foundProvidersHeader: "📋 आस-पास मिले चिकित्सा केंद्र",
    locateBtn: "मानचित्र पर देखें",
    viewFullMapSearch: "ओपनस्ट्रीटमैप पर पूर्ण खोज देखें",
    authenticating: "सत्यापित किया जा रहा है...",
    processing: "प्रक्रिया जारी है...",
    verifying: "सत्यापन जारी है...",
    patientAgeFull: "मरीज की उम्र:",
    patientGenderFull: "मरीज का लिंग",
    runAdvisorLabel: "सलाहकार इंजन चलाएं",
    diagnosticVerdictTitle: "📋 एआई निदान निर्णय",
    diagnosticVerdictSub: "दर्ज किए गए लक्षणों और मरीज की जानकारी के आधार पर",
    suggestedSpecialistLabel: "सुझाए गए विशेषज्ञ डॉक्टर:",
    hotlineAppointmentLabel: "हॉटलाइन और अपॉइंटमेंट शेड्यूलिंग:",
    emergencyWarningText: "आपातकालीन चेतावनी: तुरंत अस्पताल में इलाज लें।",
    treatmentGuidelinesLabel: "उपचार और घरेलू देखभाल दिशानिर्देश",
    directivesAdviceLabel: "निर्देश और सलाह:",
    standardHomeCareLabel: "घरेलू देखभाल और ओवर-द-काउंटर (OTC) दिशानिर्देश:",
    personalHistoryHeader: "व्यक्तिगत निदान इतिहास",
    noCaseRecords: "कोई पिछला निदान रिकॉर्ड नहीं मिला।",
    completedLogsDesc: "पूरे किए गए मामले यहां दिखाई देंगे।",
    historySymptomsLabel: "लक्षण:",
    historySpecialistLabel: "विशेषज्ञ डॉक्टर:",
    historyYrs: "वर्ष",

    active: "सक्रिय (Active)",
    degraded: "निम्न (Degraded)",
    toSignupLabel: "खाता नहीं है? ",
    toSignupLink: "यहाँ साइन अप करें",
    toLoginLabel: "पहले से पंजीकृत हैं? ",
    toLoginLink: "यहाँ लॉगिन करें",
    queryAcidity: "एसिडिटी और सीने में जलन होने पर मुझे क्या खाना चाहिए?",
    queryFever: "तेज बुखार के लिए आहार योजना और जीवनशैली की सलाह क्या है?",
    queryWomen: "यदि मुझे मासिक धर्म में ऐंठन और गर्भावस्था की संभावना हो, तो मुझे किन खाद्य पदार्थों से बचना चाहिए?",
    querySleep: "अनिद्रा और नींद की कमी के लिए तनाव मुक्ति और आहार संबंधी सुझाव क्या हैं?",
    chatbotBadge: "वेलनेस एआई",
    uploadedReportLabel: "[अपलोड की गई रिपोर्ट: {fileName}]",
    hospitalMultiSpecialty: "अस्पताल (बहु-विशेषज्ञता)",
    specialistSuffix: "विशेषज्ञ",
    medicalCenter: "चिकित्सा केंद्र",
    clinicalVerdictRouting: "क्लिनिकल निर्णय और अस्पताल रूटिंग",

    // Specialists
    specGeneral: "सामान्य चिकित्सक (General Physician)",
    specCardio: "हृदय रोग विशेषज्ञ (Cardiologist)",
    specDentist: "दंत चिकित्सक (Dentist)",
    specPediatrician: "बाल रोग विशेषज्ञ (Pediatrician)",
    specDermatologist: "त्वचा रोग विशेषज्ञ (Dermatologist)",
    specGynecologist: "स्त्री रोग विशेषज्ञ (Gynecologist)",
    specOrthopedic: "हड्डी रोग विशेषज्ञ (Orthopedic)",
    specNeurologist: "न्यूरोलॉजिस्ट (Neurologist)",
    specGastro: "पेट रोग विशेषज्ञ (Gastroenterologist)",
    specOphthal: "नेत्र रोग विशेषज्ञ (Ophthalmologist)",

    // Presets
    tagChestPain: "सीने में दर्द",
    tagFeverCough: "बुखार और खांसी",
    tagSkinAllergy: "त्वचा एलर्जी",
    tagToothache: "दांत दर्द",
    tagEyeBlur: "आँखों का धुंधलापन",
    tagStomachAcid: "पेट की एसिडिटी",
    tagAnxiety: "चिंता/तनाव"
  },
  hinglish: {
    appName: "MediGuard AI",
    home: "Home",
    dashboard: "Diagnostic Console",
    login: "Log In",
    signup: "Sign Up",
    logout: "Log Out",
    languageLabel: "Language",
    badge: "✓ AI-Powered Symptom Triage & Healthcare Finder",
    heroTitle: "AI-Powered Premium Diagnosis & Expert Locator",
    heroSubtitle: "Apne health ka advanced analysis karein. Clinical rules par based humare smart AI system se apni health risk identify karein, India ke top hospitals dhundhein, aur instant premium wellness advice paayein.",
    initPortal: "Diagnostic Portal Start Karein 🩺",
    consultWellness: "Wellness AI Se Baat Karein 💬",
    securityTitle: "System Security",
    secureStatus: "SECURE",
    diagProtocol: "DIAGNOSTIC PROTOCOL",
    privateSession: "✓ 100% Private Session",
    dbLifecycle: "DATABASE STORAGE",
    dbClusters: "MongoDB Database Logs",
    servicesHeading: "State-of-the-Art Health Features",
    servicesSubtitle: "Ek premium aur smart ecosystem jo aapke symptoms ko deeply analyze karta hai, best hospitals locate karta hai, aur personalized AI health advisor provide karta hai.",
    service1Title: "Rule-Based Symptom Analyzer",
    service1Desc: "Apne symptoms, age, aur gender enter karein. Humara system batayega ki problem Normal, Urgent ya Emergency hai aur sahi specialist recommend karein.",
    service1Tag: "Symptom Triage",
    service2Title: "Wellness AI Chatbot",
    service2Desc: "Humare AI wellness assistant se chat karein aur apne diagnosis ke basis par customized diet, sleep aur recovery tips paayein.",
    service2Tag: "AI Chat Assistant",
    service3Title: "Hospital & Clinic Map Locator",
    service3Desc: "India me apne State aur City ko select karke matching hospitals search karein. Map par location aur details live dekhein.",
    service3Tag: "Interactive Maps",
    service4Title: "Saved Diagnosis History",
    service4Desc: "Aapka sara past diagnosis history aur symptom triage logs aapke account me MongoDB database par safely save rehta hai.",
    service4Tag: "MongoDB History",
    service5Title: "Email & OTP Login",
    service5Desc: "Email ke through secure login karein. Aapki privacy ke liye login validation ke time ek simple OTP email par sent kiya jata hai.",
    service5Tag: "OTP Verification",
    service6Title: "Medical Report Parser",
    service6Desc: "Chatbot tab me apni medical prescription ya report files upload karein. AI files ko read karke recovery insights fetch karega.",
    service6Tag: "Document Support",
    timelineHeading: "System Workflow",
    timelineSubtitle: "4 simple aur secure steps me apni health evaluate karein aur best specialists se connect karein.",
    step1Title: "Secure Email Signup",
    step1Desc: "Apna account register karein aur mail par aaye verification OTP code se verification complete karein.",
    step2Title: "Enter Symptoms & Details",
    step2Desc: "Apne physical symptoms type karein, age-gender select karein ya report documents load karein.",
    step3Title: "View Urgency & Specialist",
    step3Desc: "Engine parameters verify karke proper doctor recommendations aur urgency severity score generate karega.",
    step4Title: "Search & Find Clinics",
    step4Desc: "Apne area ke State & City choose karein aur filter specialist ke according nearest clinics map par check karein.",
    ctaTitle: "Apni Health Ko Priority Dein Aaj Hi",
    ctaDesc: "Apne personal health data ko highest security ke sath save karein aur nearest best doctors se connect karein.",
    ctaButton: "Create Your Account",

    // Login View
    loginTitle: "Portal Access Login",
    loginSubtitle: "Sign in to search symptoms, save diagnosis logs, and coordinate with specialist physicians.",
    emailLabel: "Email Address",
    emailPlaceholder: "Enter registered email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    loginBtn: "Secure Log In",
    loginLoading: "Authenticating...",
    toSignup: "Don't have an account? Sign Up Here",

    // Signup View
    signupTitle: "Create Health Account",
    signupSubtitle: "Register with your email address to initialize a private and personalized diagnostic portal.",
    signupPasswordPlaceholder: "Create password (min 6 characters)",
    signupBtn: "Send Verification OTP",
    signupLoading: "Processing...",
    toLogin: "Already registered? Log In Here",

    // Verify OTP View
    verifyTitle: "Verify Email Address",
    verifySubtitle: "A 4-digit verification code has been sent to your email. Enter it below.",
    otpLabel: "Enter 4-Digit OTP Code",
    verifyBtn: "Verify & Launch Dashboard",
    verifyLoading: "Verifying...",
    resendOtp: "Did not receive code? Resend OTP Code",

    // Dashboard Subtabs
    tabAnalyzer: "🩺 Clinical Analyzer Terminal",
    tabChatbot: "💬 Consult Wellness AI",

    // Clinical Analyzer Terminal
    analyzerTitle: "Clinical Symptom Terminal",
    analyzerSubtitle: "Patient demographics aur symptoms fill karein. AI engine risk analyze karke doctor and suggestions recommend karega.",
    patientAgeLabel: "Patient Age:",
    patientGenderLabel: "Patient Gender",
    genderMale: "👨 Male",
    genderFemale: "👩 Female",
    genderOther: "🧑 Other",
    childAvatar: "Pediatric Child",
    childRange: "Age 0-12 yrs",
    seniorAvatar: "Geriatric Senior",
    seniorRange: "Age 65+ yrs",
    adultAvatar: "General Adult",
    adultRange: "Age 13-64 yrs",
    describeSymptomsLabel: "Describe Patient Symptoms",
    symptomsPlaceholder: "Type details (e.g. chest congestion, dry cough, runny nose, or dental ache)...",
    runEngine: "Run Advisor Engine",
    analyzeBtn: "Analyze Case 🩺",
    analyzingText: "Analyzing...",
    presetsLabel: "Symptom Presets",

    // Result Card
    verdictTitle: "📋 AI Diagnostic Verdict",
    verdictSubtitle: "Symptoms & demographics ke details ke basis par",
    riskBadge: "Risk",
    suggestedPhysician: "Suggested Specialty Physician:",
    hotlineLabel: "Hotline & Appointment Scheduling:",
    emergencyWarning: "EMERGENCY WARNING: Seek hospital care immediately.",
    treatmentGuidelines: "Treatment & Home Care Guidelines",
    adviceLabel: "Directives & Advice:",
    homeCareLabel: "Standard Home Care & OTC Guidelines:",

    // History logs
    historyTitle: "Personal Diagnosis History",
    noRecords: "Koi recent case logs nahi mila.",
    historyRegisteredText: "Complete checkup logs yahan dynamically show honge.",
    historyLabel: "Symptoms:",
    historySpecialist: "Specialist:",

    // Chatbot Tab
    chatbotTitle: "Clinical Wellness & Diet Agent",
    chatbotSubtitle: "Apni condition ke according diet plans, foods to avoid or eat, and general health tips check karein.",
    emptyChatMain: "MediGuard AI Agent se consult karna start karein",
    emptyChatSub: "Query niche enter karein ya koi quick starter prompt choose karein. AI guidance suggest karega.",
    chatAcidityDiet: "🍋 Diet for Acidity",
    chatFeverDiet: "🍵 Lifestyle for Fever",
    chatWomenDiet: "🤰 Women's Health Diet",
    chatSleepDiet: "💤 Rest & Sleep Guidelines",
    placeholderChat: "Diet, food ya lifestyle ke baare me puchhein...",
    placeholderChatLoading: "AI recommendation design ho rahi hai...",

    // Footer Disclaimer
    disclaimer: "⚠️ Regulatory Disclaimer: Yeh engine guidance aur common home care reference ke liye hai. Yeh doctor ka prescription ya diagnostic verdict nahi hai. Kisi emergency case me direct nearest hospital contact karein ya emergency phone line (108/112) dial karein.",
    copyright: "MediGuard AI - Clinical Decision Support Platform",

    // New localization keys
    years: "Years",
    serviceStatusLabel: "Service Status:",
    dbStoreLabel: "Database Store:",
    online: "Online",
    offline: "Offline",
    connected: "Connected",
    disconnected: "Disconnected",
    stateLabel: "State",
    cityLabel: "City",
    specialistLabel: "Specialist Required",
    selectState: "Select State",
    anySpecialist: "Any Specialist / Hospital",
    searchProvidersBtn: "🔍 Search Providers",
    useGpsBtn: "📍 Use My GPS",
    mapProviderInfo: "🗺️ Local Care Map (Powered by OpenStreetMap - Free & No Charges)",
    searchingClinics: "Searching nearest clinics...",
    foundProvidersHeader: "📋 Found Nearby Clinics & Centers",
    locateBtn: "Locate",
    viewFullMapSearch: "View Full OpenStreetMap Search",
    authenticating: "Authenticating...",
    processing: "Processing...",
    verifying: "Verifying...",
    patientAgeFull: "Patient Age:",
    patientGenderFull: "Patient Gender",
    runAdvisorLabel: "Run Advisor Engine",
    diagnosticVerdictTitle: "📋 AI Diagnostic Verdict",
    diagnosticVerdictSub: "Symptoms & demographics ke details ke basis par",
    suggestedSpecialistLabel: "Suggested Specialty Physician:",
    hotlineAppointmentLabel: "Hotline & Appointment Scheduling:",
    emergencyWarningText: "EMERGENCY WARNING: Seek hospital care immediately.",
    treatmentGuidelinesLabel: "Treatment & Home Care Guidelines",
    directivesAdviceLabel: "Directives & Advice:",
    standardHomeCareLabel: "Standard Home Care & OTC Guidelines:",
    personalHistoryHeader: "Personal Diagnosis History",
    noCaseRecords: "Koi recent case logs nahi mila.",
    completedLogsDesc: "Complete checkup logs yahan dynamically show honge.",
    historySymptomsLabel: "Symptoms:",
    historySpecialistLabel: "Specialist:",
    historyYrs: "yrs",

    active: "Active",
    degraded: "Degraded",
    toSignupLabel: "Account nahi hai? ",
    toSignupLink: "Sign Up Here",
    toLoginLabel: "Already registered? ",
    toLoginLink: "Log In Here",
    queryAcidity: "Acidity aur heartburn hone par mujhe kya khana chahiye?",
    queryFever: "Tez fever ke liye diet plan aur lifestyle advice suggest karein?",
    queryWomen: "Menstrual cramps aur pregnancy possibility me mujhe kaun se food items avoid karne chahiye?",
    querySleep: "Insomnia aur neend ki kami ke liye stress relief aur diet tips kya hain?",
    chatbotBadge: "Wellness AI",
    uploadedReportLabel: "[Uploaded Report: {fileName}]",
    hospitalMultiSpecialty: "Hospital (Multi-Specialty)",
    specialistSuffix: "Specialist",
    medicalCenter: "Medical Center",
    clinicalVerdictRouting: "Clinical Verdict & Routing",

    // Specialists
    specGeneral: "General Physician",
    specCardio: "Cardiologist (Heart)",
    specDentist: "Dentist (Dental)",
    specPediatrician: "Pediatrician (Kids)",
    specDermatologist: "Dermatologist (Skin)",
    specGynecologist: "Gynecologist (Women)",
    specOrthopedic: "Orthopedic (Bones)",
    specNeurologist: "Neurologist (Brain)",
    specGastro: "Gastroenterologist (Stomach)",
    specOphthal: "Ophthalmologist (Eyes)",

    // Presets
    tagChestPain: "Chest Pain",
    tagFeverCough: "Fever & Cough",
    tagSkinAllergy: "Skin Allergy",
    tagToothache: "Toothache",
    tagEyeBlur: "Eye Blurriness",
    tagStomachAcid: "Stomach Acid",
    tagAnxiety: "Anxiety"
  }
};

const DIAGNOSTIC_TRANSLATIONS = {
  hi: {
    // Doctors
    "Gynecologist & Obstetrician": "स्त्री रोग और प्रसूति विशेषज्ञ (Gynecologist)",
    "Emergency Care / Cardiologist": "आपातकालीन देखभाल / हृदय रोग विशेषज्ञ (Cardiologist)",
    "Pediatric Emergency Specialist": "बाल रोग आपातकालीन विशेषज्ञ (Pediatric ER)",
    "Pediatrician": "बाल रोग विशेषज्ञ (Pediatrician)",
    "General Physician": "सामान्य चिकित्सक (General Physician)",
    "Geriatric General Physician": "वृद्ध रोग विशेषज्ञ (Geriatric GP)",
    "Pediatric Dermatologist": "बच्चों के त्वचा रोग विशेषज्ञ (Pediatric Dermatologist)",
    "Dermatologist": "त्वचा रोग विशेषज्ञ (Dermatologist)",
    "Dermatologist / Geriatric Specialist": "त्वचा रोग / वृद्ध रोग विशेषज्ञ (Dermatologist / Geriatric)",
    "Pediatric Dentist": "बच्चों के दंत चिकित्सक (Pediatric Dentist)",
    "Dentist": "दंत चिकित्सक (Dentist)",
    "Pediatric Ophthalmologist": "बच्चों के नेत्र रोग विशेषज्ञ (Pediatric Ophthalmologist)",
    "Ophthalmologist": "नेत्र रोग विशेषज्ञ (Ophthalmologist)",
    "Ophthalmologist / Retinal Specialist": "नेत्र रोग / रेटिना विशेषज्ञ (Ophthalmologist / Retinal Specialist)",
    "Gastroenterologist": "पेट और पाचन रोग विशेषज्ञ (Gastroenterologist)",
    "Gastroenterologist / Geriatric Physician": "पेट रोग / वृद्ध रोग विशेषज्ञ (Gastroenterologist / Geriatric GP)",
    "Child Psychologist": "बाल मनोवैज्ञानिक (Child Psychologist)",
    "Psychologist / Psychiatrist": "मनोवैज्ञानिक / मनोचिकित्सक (Psychologist / Psychiatrist)",
    "Geriatric Psychiatrist / Neurologist": "वृद्ध मनोचिकित्सक / न्यूरोलॉजिस्ट (Geriatric Psychiatrist / Neurologist)",
    
    // Risks
    "Normal": "सामान्य (Normal)",
    "Urgent": "गंभीर (Urgent)",
    "Emergency": "आपातकालीन (Emergency)",

    // Advices
    "Ensure adequate hydration, take warm baths for cramps, and consult a Gynecologist if symptoms persist or if you suspect pregnancy.": "पर्याप्त मात्रा में पानी पीएं, ऐंठन के लिए गर्म पानी से स्नान करें, और लक्षण बने रहने या गर्भावस्था का संदेह होने पर स्त्री रोग विशेषज्ञ से परामर्श लें।",
    "This may be an emergency. Please visit the nearest hospital immediately.": "यह एक आपातकालीन स्थिति हो सकती है। कृपया तुरंत नजदीकी अस्पताल जाएं।",
    "Take rest, drink water, and consult a doctor if symptoms continue.": "आराम करें, पानी पीएं और लक्षण बने रहने पर डॉक्टर से सलाह लें।",
    "Avoid scratching and consult a skin specialist.": "खुजलाने से बचें और त्वचा विशेषज्ञ से सलाह लें।",
    "Avoid very hot or cold food and visit a dentist.": "बहुत गर्म या ठंडे भोजन से बचें और दंत चिकित्सक से मिलें।",
    "Do not rub your eyes and visit an eye specialist.": "अपनी आँखों को न रगड़ें और नेत्र रोग विशेषज्ञ से मिलें।",
    "Drink fluids and consult a doctor if pain is severe.": "तरल पदार्थ पीएं और दर्द गंभीर होने पर डॉक्टर से सलाह लें।",
    "Talk to someone trusted and consult a mental health professional.": "किसी विश्वसनीय व्यक्ति से बात करें और मानसिक स्वास्थ्य पेशेवर से सलाह लें।",
    "Symptoms are not clearly matched. Please consult a specialist for proper guidance.": "लक्षण स्पष्ट रूप से मेल नहीं खाते हैं। कृपया उचित मार्गदर्शन के लिए किसी विशेषज्ञ से परामर्श लें।",
  },
  hinglish: {
    // Doctors
    "Gynecologist & Obstetrician": "Gynecologist & Obstetrician",
    "Emergency Care / Cardiologist": "Emergency Care / Cardiologist",
    "Pediatric Emergency Specialist": "Pediatric Emergency Specialist",
    "Pediatrician": "Pediatrician",
    "General Physician": "General Physician",
    "Geriatric General Physician": "Geriatric General Physician",
    "Pediatric Dermatologist": "Pediatric Dermatologist",
    "Dermatologist": "Dermatologist",
    "Dermatologist / Geriatric Specialist": "Dermatologist / Geriatric Specialist",
    "Pediatric Dentist": "Pediatric Dentist",
    "Dentist": "Dentist",
    "Pediatric Ophthalmologist": "Pediatric Ophthalmologist",
    "Ophthalmologist": "Ophthalmologist",
    "Ophthalmologist / Retinal Specialist": "Ophthalmologist / Retinal Specialist",
    "Gastroenterologist": "Gastroenterologist",
    "Gastroenterologist / Geriatric Physician": "Gastroenterologist / Geriatric Physician",
    "Child Psychologist": "Child Psychologist",
    "Psychologist / Psychiatrist": "Psychologist / Psychiatrist",
    "Geriatric Psychiatrist / Neurologist": "Geriatric Psychiatrist / Neurologist",

    // Risks
    "Normal": "Normal",
    "Urgent": "Urgent",
    "Emergency": "Emergency",

    // Advices
    "Ensure adequate hydration, take warm baths for cramps, and consult a Gynecologist if symptoms persist or if you suspect pregnancy.": "Pani khoob peeyein, cramps ke liye warm bath lein, aur pregnancy lagne par gynecologist se consult karein.",
    "This may be an emergency. Please visit the nearest hospital immediately.": "Yeh ek emergency ho sakti hai. Kripya turant nearest hospital visit karein.",
    "Take rest, drink water, and consult a doctor if symptoms continue.": "Rest karein, paani peeyein, aur agar symptoms theek na ho toh doctor se consult karein.",
    "Avoid scratching and consult a skin specialist.": "Scratching se bachein aur skin specialist se consult karein.",
    "Avoid very hot or cold food and visit a dentist.": "Boht garam ya thanda khane se bachein aur dentist ko dikhayein.",
    "Do not rub your eyes and visit an eye specialist.": "Eyes ko rub na karein aur eye specialist ko dikhayein.",
    "Drink fluids and consult a doctor if pain is severe.": "Fluids peeyein aur dard severe hone par doctor se consult karein.",
    "Talk to someone trusted and consult a mental health professional.": "Kisi trusted insaan se baat karein aur mental health professional se consult karein.",
    "Symptoms are not clearly matched. Please consult a specialist for proper guidance.": "Symptoms clear match nahi huye hain. Proper guidance ke liye doctor se consult karein."
  }
};

const REMEDY_TRANSLATIONS = {
  hi: {
    "1. Standard Care: Use hot water bag on the lower abdomen for cramp relief. Sip warm ginger or chamomile tea.": "1. सामान्य देखभाल: ऐंठन से राहत के लिए निचले पेट पर गर्म पानी की थैली का उपयोग करें। गर्म अदरक या कैमोमाइल चाय पिएं।",
    "2. Pain relief: Paracetamol 500mg (1 tablet every 6 hours, max 3/day) is safer than Ibuprofen if there is any chance of pregnancy.": "2. दर्द से राहत: यदि गर्भावस्था की कोई भी संभावना है, तो इबुप्रोफेन की तुलना में पैरासिटामोल 500mg (हर 6 घंटे में 1 गोली, अधिकतम 3/दिन) अधिक सुरक्षित है।",
    "Avoid NSAIDs (like Ibuprofen/Aspirin) if pregnancy is possible without doctor approval. Seek urgent care if abdominal pain is severe and sudden.": "यदि गर्भावस्था संभव है, तो डॉक्टर की मंजूरी के बिना एनएसएआईडी (जैसे इबुप्रोफेन/एस्पिरिन) से बचें। पेट में तेज और अचानक दर्द होने पर तुरंत इलाज लें।",
    "1. NO SELF-MEDICATION: Do NOT give any adult pills or child syrups.": "1. कोई स्व-दवा नहीं: बच्चों को कोई भी वयस्क दवा या बच्चों का सिरप न दें।",
    "2. Action: Keep the child calm, upright, and transport to the nearest Pediatric Emergency Room immediately.": "2. कार्रवाई: बच्चे को शांत और सीधा रखें, और तुरंत नजदीकी बच्चों के आपातकालीन कक्ष (Pediatric ER) में ले जाएं।",
    "1. NO SELF-MEDICATION: Avoid administering high-dose aspirin or other drugs without emergency dispatch approval.": "1. कोई स्व-दवा नहीं: आपातकालीन सेवा की मंजूरी के बिना उच्च खुराक वाली एस्पिरिन या अन्य दवाएं देने से बचें।",
    "2. Action: Help the patient rest in a comfortable semi-reclining position, keep warm, and monitor breathing until help arrives.": "2. कार्रवाई: मरीज को आरामदायक अध-लेटी स्थिति में आराम करने में मदद करें, गर्म रखें और सहायता आने तक सांस लेने की निगरानी करें।",
    "1. NO SELF-MEDICATION: Do NOT take any pain relievers or generic tablets as it may interact dangerously with emergency treatments.": "1. कोई स्व-दवा नहीं: कोई भी दर्द निवारक या सामान्य गोलियां न लें क्योंकि यह आपातकालीन उपचार के साथ खतरनाक रूप से परस्पर क्रिया कर सकती हैं।",
    "2. Action: Loosen tight clothing, sit upright, keep airways clear, and seek emergency hospital transport immediately.": "2. कार्रवाई: तंग कपड़े ढीले करें, सीधे बैठें, वायुमार्ग साफ रखें, और तुरंत आपातकालीन अस्पताल परिवहन की तलाश करें।",
    "1. Standard Care: Keep hydrated with water and warm soups. Clean nose with saline drops.": "1. सामान्य देखभाल: पानी और गर्म सूप से हाइड्रेटेड रहें। खारे पानी (saline) की बूंदों से नाक साफ करें।",
    "2. OTC: Use Pediatric Paracetamol suspension/syrup (dosage MUST be based on the child's exact weight, check bottle).": "2. ओटीसी: बाल रोग पैरासिटामोल निलंबन/सिरप का उपयोग करें (खुराक बच्चे के सटीक वजन पर आधारित होनी चाहिए, बोतल की जांच करें)।",
    "Never give Aspirin to children due to Reye's Syndrome risk. Seek medical check if fever exceeds 102°F (38.9°C).": "रेयेस सिंड्रोम (Reye's Syndrome) के जोखिम के कारण बच्चों को कभी भी एस्पिरिन न दें। यदि बुखार 102°F (38.9°C) से अधिक हो जाता है, तो चिकित्सक से जांच कराएं।",
    "1. Standard OTC: Paracetamol 500mg - 1 tablet every 4-6 hours as needed (Max: 4 tablets/2000mg per day, after food).": "1. मानक ओटीसी: पैरासिटामोल 500mg - आवश्यकतानुसार हर 4-6 घंटे में 1 गोली (अधिकतम: 4 गोलियां/2000mg प्रतिदिन, भोजन के बाद)।",
    "2. For Cold: Steam inhalation 2 times a day. OTC Cetirizine 10mg (1 tablet at night if nose is runny).": "2. सर्दी के लिए: दिन में 2 बार भाप लें। ओटीसी सिटिरिज़िन 10mg (नाक बहने पर रात में 1 गोली)।",
    "Never exceed 4000mg of Paracetamol per day to avoid liver risk.": "लिवर के जोखिम से बचने के लिए प्रतिदिन 4000mg से अधिक पैरासिटामोल कभी न लें।",
    "1. Standard Care: Warm fluids, strict rest, and check temperature.": "1. सामान्य देखभाल: गर्म तरल पदार्थ, सख्त आराम, और तापमान की जांच करें।",
    "2. OTC: Acetaminophen/Paracetamol 325mg or 500mg - 1 tablet (Max: 3 tablets/1500mg per day).": "2. ओटीसी: एसिटामिनोफेन/पैरासिटामोल 325mg या 500mg - 1 गोली (अधिकतम: 3 गोलियां/1500mg प्रतिदिन)।",
    "Seniors are more sensitive to drug side effects. Avoid NSAIDs (like Ibuprofen) if history of high blood pressure, heart disease, or kidney issues exists.": "वरिष्ठ नागरिक दवाओं के दुष्प्रभावों के प्रति अधिक संवेदनशील होते हैं। यदि उच्च रक्तचाप, हृदय रोग, या गुर्दे की समस्याओं का इतिहास है, तो एनएसएआईडी (जैसे इबुप्रोफेन) से बचें।",
    "1. Care: Bathe with lukewarm water. Apply cold compresses.": "1. देखभाल: गुनगुने पानी से स्नान करें। ठंडी सिकाई करें।",
    "2. OTC: Apply light Calamine lotion. Ask pediatrician before giving oral antihistamine syrups.": "2. ओटीसी: हल्की कैलामाइन लोशन लगाएं। ओरल एंटीहिस्टामाइन सिरप देने से पहले बाल रोग विशेषज्ञ से पूछें।",
    "Do not let the child scratch to avoid skin infections. Avoid heavily scented lotions.": "त्वचा के संक्रमण से बचने के लिए बच्चे को खुजलाने न दें। अत्यधिक सुगंधित लोशन से बचें।",
    "1. OTC: Apply Calamine Lotion locally on the affected skin 3-4 times a day.": "1. ओटीसी: प्रभावित त्वचा पर दिन में 3-4 बार स्थानीय रूप से कैलामाइन लोशन लगाएं।",
    "2. For Allergy: OTC Cetirizine 10mg (1 tablet at night) can control itching.": "2. एलर्जी के लिए: ओटीसी सिटिरिज़िन 10mg (रात में 1 गोली) खुजली को नियंत्रित कर सकती है।",
    "Do not apply calamine on open wounds.": "खुले घावों पर कैलामाइन न लगाएं।",
    "1. Care: Apply Calamine lotion or coconut oil to soothe dry, itchy skin.": "1. देखभाल: सूखी, खुजलीदार त्वचा को शांत करने के लिए कैलामाइन लोशन या नारियल तेल लगाएं।",
    "2. Hydration: Maintain room humidity and use thick, fragrance-free moisturizers.": "2. हाइड्रेशन: कमरे की नमी बनाए रखें और गाढ़े, सुगंध-मुक्त मॉइस्चराइज़र का उपयोग करें।",
    "Antihistamines like Cetirizine can cause increased drowsiness and fall risk in seniors. Use with caution.": "सिटिरिज़िन जैसे एंटीहिस्टामाइन बुजुर्गों में उनींदापन और गिरने का खतरा बढ़ा सकते हैं। सावधानी के साथ प्रयोग करें।",
    "1. Care: Warm water mouth rinse. Gently floss to clear trapped food.": "1. देखभाल: गर्म पानी से मुंह का कुल्ला करें। फंसे हुए भोजन को साफ करने के लिए धीरे से फ्लॉस करें।",
    "2. OTC: Pediatric Ibuprofen suspension (only if after meals, weight-based dosage).": "2. ओटीसी: पीडियाट्रिक इबुप्रोफेन सस्पेंशन (केवल भोजन के बाद, वजन-आधारित खुराक)।",
    "Do NOT put aspirin pills directly on gums as it burns the tissue. Consult a pediatric dentist.": "एस्पिरिन की गोलियों को सीधे मसूड़ों पर न रखें क्योंकि यह ऊतक (tissue) को जला देता है। बाल रोग दंत चिकित्सक से परामर्श लें।",
    "1. OTC: Ibuprofen 400mg - 1 tablet every 6-8 hours as needed (Max: 1200mg/day, always after food).": "1. ओटीसी: इबुप्रोफेन 400mg - आवश्यकतानुसार हर 6-8 घंटे में 1 गोली (अधिकतम: 1200mg/दिन, हमेशा भोजन के बाद)।",
    "2. Rinse mouth with warm salt water 3-4 times a day.": "2. दिन में 3-4 बार गुनगुने नमक वाले पानी से मुँह धोएँ।",
    "Avoid Ibuprofen if history of stomach ulcers or asthma.": "यदि पेट के अल्सर या अस्थमा का इतिहास है, तो इबुप्रोफेन से बचें।",
    "1. Care: Warm salt water gargles. Eat soft foods at room temperature.": "1. देखभाल: गर्म नमक के पानी से गरारे करें। कमरे के तापमान पर नरम भोजन खाएं।",
    "2. Pain relief: Paracetamol/Acetaminophen 500mg (1 tablet, max 3/day) is safer than Ibuprofen for senior dental pain.": "2. दर्द निवारक: वरिष्ठ दंत चिकित्सा दर्द के लिए इबुप्रोफेन की तुलना में पैरासिटामोल/एसिटामिनोफेन 500mg (1 गोली, अधिकतम 3/दिन) अधिक सुरक्षित है।",
    "Avoid NSAIDs if taking blood thinners or if suffering from chronic kidney disease.": "यदि रक्त पतला करने वाली दवाएं ले रहे हैं या पुरानी गुर्दे की बीमारी से पीड़ित हैं तो एनएसएआईडी से बचें।",
    "1. Care: Cover eye with a cool, damp clean cloth. Avoid screens.": "1. देखभाल: आँख को ठंडे, नम साफ कपड़े से ढकें। स्क्रीन से बचें।",
    "2. Action: Prevent child from rubbing the eyes.": "2. कार्रवाई: बच्चे को आंखें रगड़ने से रोकें।",
    "Never use adult over-the-counter redness relief drops in children.": "बच्चों में कभी भी वयस्कों के ओटीसी लालिमा निवारक ड्रॉप्स का उपयोग न करें।",
    "1. OTC: Lubricating Eye Drops (CMC 0.5%) - 1 to 2 drops in the affected eye 3-4 times a day.": "1. ओटीसी: ल्यूब्रिकेटिंग आई ड्रॉप्स (सीएमसी 0.5%) - प्रभावित आंख में दिन में 3-4 बार 1 से 2 बूंदें।",
    "2. Flush gently with room-temperature water.": "2. कमरे के तापमान वाले पानी से धीरे-धीरे धोएं।",
    "Discontinue drops and see a doctor if eye pain increases.": "यदि आंख का दर्द बढ़ता है, तो ड्रॉप्स बंद कर दें और डॉक्टर को दिखाएं।",
    "1. OTC: Preservative-free lubricating eye drops (artificial tears) to soothe dry eyes.": "1. ओटीसी: सूखी आंखों को शांत करने के लिए परिरक्षक-मुक्त (preservative-free) लुब्रिकेटिंग आई ड्रॉप्स (कृत्रिम आँसू) डालें।",
    "2. Safety: Ensure well-lit walkways to prevent falls if vision is blurry.": "2. सुरक्षा: यदि दृष्टि धुंधली है तो गिरने से रोकने के लिए चलने के रास्तों में अच्छी रोशनी सुनिश्चित करें।",
    "Sudden vision changes in seniors can indicate urgent issues like glaucoma or stroke. Check with an ophthalmologist immediately.": "बुजुर्गों में अचानक दृष्टि परिवर्तन ग्लूकोमा या स्ट्रोक जैसी तत्काल समस्याओं का संकेत दे सकते हैं। तुरंत नेत्र रोग विशेषज्ञ से जांच कराएं।",
    "1. Hydration: Sip ORS (Oral Rehydration Solution) or coconut water continuously in small spoonfuls (every 5-10 mins).": "1. हाइड्रेशन: छोटे चम्मचों से लगातार ओआरएस या नारियल पानी पिएं (हर 5-10 मिनट में)।",
    "2. Food: Give small amounts of bland foods (banana, curd-rice).": "2. भोजन: कम मात्रा में हल्का भोजन (केला, दही-चावल) दें।",
    "Do NOT give anti-diarrheal medicines (like Loperamide) to children as it can be highly dangerous.": "बच्चों को दस्त-रोधी दवाएं (जैसे लोपेरामाइड) न दें क्योंकि यह अत्यधिक खतरनाक हो सकता है।",
    "1. OTC: Antacid Liquid - 10-20ml 30-60 mins after meals. Sip ORS (1 sachet dissolved in 1 Litre water) throughout the day.": "1. ओटीसी: एंटासिड लिक्विड - भोजन के 30-60 मिनट बाद 10-20ml लें। दिन भर ओआरएस का घूंट लें।",
    "2. Food: Eat light, bland meals.": "2. भोजन: हल्का और सादा भोजन करें।",
    "See doctor if vomiting is persistent or blood is noticed.": "यदि उल्टी लगातार हो रही हो या खून दिखाई दे, तो डॉक्टर को दिखाएं।",
    "1. Hydration: Sip warm water, ORS, or weak tea. Seniors dehydrate very rapidly.": "1. हाइड्रेशन: गुनगुना पानी, ओआरएस या हल्की चाय पिएं। वरिष्ठ नागरिक बहुत तेजी से निर्जलित (dehydrate) होते हैं।",
    "2. Care: Avoid self-prescribing laxatives or antidiarrheal medicines.": "2. देखभाल: खुद से जुलाब या दस्त-रोधी दवाएं लेने से बचें।",
    "Abdominal pain in seniors can indicate serious underlying issues. Monitor for low blood pressure or confusion.": "बुजुर्गों में पेट का दर्द गंभीर समस्याओं का संकेत हो सकता है। निम्न रक्तचाप या भ्रम की निगरानी करें।",
    "1. Care: Set a consistent comforting routine. Ensure 9-11 hours of sleep.": "1. Care: Ek fixed comforting routine banayein. 9-11 ghante ki neend zaroor lein.",
    "2. Action: Encourage emotional expression through drawing or play, and limit screen time.": "2. कार्रवाई: ड्राइंग या खेल के माध्यम से भावनात्मक अभिव्यक्ति को प्रोत्साहित करें, और स्क्रीन समय सीमित करें।",
    "Seek counseling if behavior swings or school withdrawal is observed.": "यदि व्यवहार में उतार-चढ़ाव या स्कूल से दूरी देखी जाती है, तो परामर्श लें।",
    "1. Care: Deep breathing exercises (4-7-8 method), limit screens, drink warm chamomile tea.": "1. देखभाल: गहरे साँस लेने के व्यायाम (4-7-8 विधि), स्क्रीन सीमित करें, गर्म कैमोमाइल चाय पिएं।",
    "2. Activity: Moderate physical exercise (15-min walk).": "2. गतिविधि: मध्यम शारीरिक व्यायाम (15 मिनट की पैदल यात्रा)।",
    "Avoid self-prescribing sedative pills.": "खुद से नींद की गोलियां लेने से बचें।",
    "1. Care: Practice light stretching, gentle breathing, and connect socially with family.": "1. देखभाल: हल्की स्ट्रेचिंग, सांस लेने का अभ्यास करें और परिवार के साथ सामाजिक रूप से जुड़ें।",
    "2. Environment: Keep sleep environments quiet and dark.": "2. वातावरण: सोने के वातावरण को शांत और अंधेरा रखें।",
    "Insomnia or anxiety in seniors is often linked to medication side-effects or vascular conditions. Consult a geriatrician.": "बुजुर्गों में अनिद्रा या चिंता अक्सर दवाओं के दुष्प्रभावों या संवहनी स्थितियों (vascular conditions) से जुड़ी होती है। जेरियाट्रीशियन से सलाह लें।",
    "Ensure rest, keep the child hydrated with water/soups, and consult a Pediatrician for weight-appropriate medications.": "आराम सुनिश्चित करें, बच्चे को पानी/सूप से हाइड्रेटेड रखें, और बाल रोग विशेषज्ञ से परामर्श लें।",
    "Ensure rest, keep hydrated, monitor temperature, and consult a General Physician.": "आराम सुनिश्चित करें, हाइड्रेटेड रहें, तापमान की निगरानी करें, और सामान्य चिकित्सक से परामर्श लें।",
    "Rest, monitor vital signs (BP, temperature), keep hydrated, and consult a Geriatric General Physician.": "आराम करें, महत्वपूर्ण संकेतों (रक्तचाप, तापमान) की निगरानी करें, हाइड्रेटेड रहें और डॉक्टर से परामर्श लें।"
  },
  hinglish: {
    "1. Standard Care: Use hot water bag on the lower abdomen for cramp relief. Sip warm ginger or chamomile tea.": "1. Standard Care: Lower abdomen par hot water bag use karein cramps relief ke liye. Ginger ya chamomile tea peeyein.",
    "2. Pain relief: Paracetamol 500mg (1 tablet every 6 hours, max 3/day) is safer than Ibuprofen if there is any chance of pregnancy.": "2. Pain relief: Agar pregnancy ke thode bhi chances hain, toh Ibuprofen ki jagah Paracetamol 500mg lena zyaada safe hai.",
    "Avoid NSAIDs (like Ibuprofen/Aspirin) if pregnancy is possible without doctor approval. Seek urgent care if abdominal pain is severe and sudden.": "Agar pregnancy possible hai toh Ibuprofen/Aspirin na lein. Severe aur sudden abdominal pain hone par turant doctor ke paas jayein.",
    "1. NO SELF-MEDICATION: Do NOT give any adult pills or child syrups.": "1. NO SELF-MEDICATION: Baccho ko koi adult medicine ya syrup na dein.",
    "2. Action: Keep the child calm, upright, and transport to the nearest Pediatric Emergency Room immediately.": "2. Action: Bacche ko calm aur seedha rakhein, aur turant nearest Pediatric ER me le kar jayein.",
    "1. NO SELF-MEDICATION: Avoid administering high-dose aspirin or other drugs without emergency dispatch approval.": "1. NO SELF-MEDICATION: Emergency department ki approval ke bina aspirin ya koi aur medicines na dein.",
    "2. Action: Help the patient rest in a comfortable semi-reclining position, keep warm, and monitor breathing until help arrives.": "2. Action: Patient ko comfortable position me rest karne dein aur help aane tak unki breathing monitor karein.",
    "1. NO SELF-MEDICATION: Do NOT take any pain relievers or generic tablets as it may interact dangerously with emergency treatments.": "1. NO SELF-MEDICATION: Koi pain reliever ya generic medicine na lein kyunki yeh emergency treatment ke sath react kar sakti hai.",
    "2. Action: Loosen tight clothing, sit upright, keep airways clear, and seek emergency hospital transport immediately.": "2. Action: Tight kapdo ko dheela karein, seedhe baithein aur turant ambulance call karein.",
    "1. Standard Care: Keep hydrated with water and warm soups. Clean nose with saline drops.": "1. Standard Care: Paani aur garam soup peete rahein. Saline drops se nose clean karein.",
    "2. OTC: Use Pediatric Paracetamol suspension/syrup (dosage MUST be based on the child's exact weight, check bottle).": "2. OTC: Pediatric Paracetamol syrup use karein (dosage weight ke hisab se check karke hi dein).",
    "Never give Aspirin to children due to Reye's Syndrome risk. Seek medical check if fever exceeds 102°F (38.9°C).": "Reye's Syndrome ke risk ki wajah se baccho ko Aspirin bilkul na dein. Agar fever 102°F se upar jaye toh doctor ko dikhayein.",
    "1. Standard OTC: Paracetamol 500mg - 1 tablet every 4-6 hours as needed (Max: 4 tablets/2000mg per day, after food).": "1. Standard OTC: Paracetamol 500mg - zaroorat ke hisab se 1 tablet har 4-6 ghante me (Max: 4 tablets per day, khane ke baad).",
    "2. For Cold: Steam inhalation 2 times a day. OTC Cetirizine 10mg (1 tablet at night if nose is runny).": "2. For Cold: Din me 2 baar steam lein. Behti naak ke liye raat me 1 Cetirizine 10mg le sakte hain.",
    "Never exceed 4000mg of Paracetamol per day to avoid liver risk.": "Liver damage se bachne ke liye 24 ghante me 4000mg se zyada Paracetamol na lein.",
    "1. Standard Care: Warm fluids, strict rest, and check temperature.": "1. Standard Care: Garam liquids peeyein, rest karein aur temperature check karte rahein.",
    "2. OTC: Acetaminophen/Paracetamol 325mg or 500mg - 1 tablet (Max: 3 tablets/1500mg per day).": "2. OTC: Paracetamol 325mg ya 500mg - 1 tablet (Max: 3 tablets per day).",
    "Seniors are more sensitive to drug side effects. Avoid NSAIDs (like Ibuprofen) if history of high blood pressure, heart disease, or kidney issues exists.": "Elderly logo me side effects ka risk zyada hota hai. BP ya kidney problems me Ibuprofen avoid karein.",
    "1. Care: Bathe with lukewarm water. Apply cold compresses.": "1. Care: Gungune paani se nahayein aur thandi compression apply karein.",
    "2. OTC: Apply light Calamine lotion. Ask pediatrician before giving oral antihistamine syrups.": "2. OTC: Calamine lotion apply karein. Antihistamine dene se pehle doctor se confirm karein.",
    "Do not let the child scratch to avoid skin infections. Avoid heavily scented lotions.": "Khujlane na dein taaki skin infection na ho. Heavy perfumes wale lotions avoid karein.",
    "1. OTC: Apply Calamine Lotion locally on the affected skin 3-4 times a day.": "1. OTC: Skin par din me 3-4 baar Calamine lotion lagayein.",
    "2. For Allergy: OTC Cetirizine 10mg (1 tablet at night) can control itching.": "2. For Allergy: Khujli ke liye raat ko 1 tablet Cetirizine 10mg le sakte hain.",
    "Do not apply calamine on open wounds.": "Khule zakhmo par calamine lotion na lagayein.",
    "1. Care: Apply Calamine lotion or coconut oil to soothe dry, itchy skin.": "1. Care: Dry skin ko theek karne ke liye Calamine lotion ya coconut oil lagayein.",
    "2. Hydration: Maintain room humidity and use thick, fragrance-free moisturizers.": "2. Hydration: Room me humidity maintain karein aur moisturizers use karein.",
    "Antihistamines like Cetirizine can cause increased drowsiness and fall risk in seniors. Use with caution.": "Seniors me Cetirizine se neend aa sakti hai aur girne ka risk badh sakta hai. Caution ke sath use karein.",
    "1. Care: Warm water mouth rinse. Gently floss to clear trapped food.": "1. Care: Gungune paani se rinse karein. Gently floss karein taaki food particles nikal jayein.",
    "2. OTC: Pediatric Ibuprofen suspension (only if after meals, weight-based dosage).": "2. OTC: Pediatric Ibuprofen suspension dein (khane ke baad, weight ke according).",
    "Do NOT put aspirin pills directly on gums as it burns the tissue. Consult a pediatric dentist.": "Aspirin tablet ko seedhe gums par na rakhein kyunki yeh tissue burn kar sakti hai.",
    "1. OTC: Ibuprofen 400mg - 1 tablet every 6-8 hours as needed (Max: 1200mg/day, always after food).": "1. OTC: Ibuprofen 400mg - zaroorat ke hisab se 1 tablet har 6-8 ghante me (Max: 1200mg/day, humesha khane ke baad).",
    "2. Rinse mouth with warm salt water 3-4 times a day.": "2. Din me 3-4 baar warm salt water se rinse karein.",
    "Avoid Ibuprofen if history of stomach ulcers or asthma.": "Stomach ulcers ya asthma me Ibuprofen avoid karein.",
    "1. Care: Warm salt water gargles. Eat soft foods at room temperature.": "1. Care: Garam namak wale paani se rinse karein. Soft food khayein.",
    "2. Pain relief: Paracetamol/Acetaminophen 500mg (1 tablet, max 3/day) is safer than Ibuprofen for senior dental pain.": "2. Pain relief: Seniors ke dental pain me Ibuprofen ki jagah Paracetamol 500mg zyada safe hai.",
    "Avoid NSAIDs if taking blood thinners or if suffering from chronic kidney disease.": "Blood thinners ya kidney disease me NSAIDs na lein.",
    "1. Care: Cover eye with a cool, damp clean cloth. Avoid screens.": "1. Care: Clean cool cloth se eye cover karein. Mobile/TV screen se door rahein.",
    "2. Action: Prevent child from rubbing the eyes.": "2. Action: Bacche ko eyes rub karne se rokein.",
    "Never use adult over-the-counter redness relief drops in children.": "Baccho me kabhi bhi adult eye drops use na karein.",
    "1. OTC: Lubricating Eye Drops (CMC 0.5%) - 1 to 2 drops in the affected eye 3-4 times a day.": "1. OTC: Lubricating Eye Drops (CMC 0.5%) - din me 3-4 baar 1-2 drops affected eye me dalein.",
    "2. Flush gently with room-temperature water.": "2. Room temperature paani se gently aankhein saaf karein.",
    "Discontinue drops and see a doctor if eye pain increases.": "Dard badhne par drops band karke doctor se consult karein.",
    "1. OTC: Preservative-free lubricating eye drops (artificial tears) to soothe dry eyes.": "1. OTC: Dry eyes ke liye preservative-free lubricating drops use karein.",
    "2. Safety: Ensure well-lit walkways to prevent falls if vision is blurry.": "2. Safety: Blurry vision me girne se bachne ke liye rooms me proper light rakhein.",
    "Sudden vision changes in seniors can indicate urgent issues like glaucoma or stroke. Check with an ophthalmologist immediately.": "Sudden vision change glaucoma ya stroke ka signal ho sakta hai, turant ophthalmologist se checkup karayein.",
    "1. Hydration: Sip ORS (Oral Rehydration Solution) or coconut water continuously in small spoonfuls (every 5-10 mins).": "1. Hydration: Thoda-thoda ORS solution ya coconut water har 5-10 mins me peeyein.",
    "2. Food: Give small amounts of bland foods (banana, curd-rice).": "2. Food: Halki cheezein khane ko dein (jaise kela, dahi-chawal).",
    "Do NOT give anti-diarrheal medicines (like Loperamide) to children as it can be highly dangerous.": "Baccho ko Loperamide ya koi loose motion medicine doctor ke bina bilkul na dein.",
    "1. OTC: Antacid Liquid - 10-20ml 30-60 mins after meals. Sip ORS (1 sachet dissolved in 1 Litre water) throughout the day.": "1. OTC: Antacid Liquid - khane ke 30-60 mins baad 10-20ml. Saara din ORS paani peeyein.",
    "2. Food: Eat light, bland meals.": "2. Food: Light aur simple food khayein.",
    "See doctor if vomiting is persistent or blood is noticed.": "Agar vomiting band na ho ya blood aaye toh immediate doctor ke paas jayein.",
    "1. Hydration: Sip warm water, ORS, or weak tea. Seniors dehydrate very rapidly.": "1. Hydration: Gunguna paani ya ORS peeyein. Seniors me dehydration jaldi hoti hai.",
    "2. Care: Avoid self-prescribing laxatives or antidiarrheal medicines.": "2. Care: Khud se dhyan rakhein aur bina doctor ke loose motion capsules na lein.",
    "Abdominal pain in seniors can indicate serious underlying issues. Monitor for low blood pressure or confusion.": "Seniors me pet dard serious ho sakta hai. Unke BP aur pulse ka dhyan rakhein.",
    "1. Care: Set a consistent comforting routine. Ensure 9-11 hours of sleep.": "1. Care: Sleep routine maintain karein aur 9-11 hours ki sleep complete hone dein.",
    "2. Action: Encourage emotional expression through drawing or play, and limit screen time.": "2. Action: Drawing aur games ke through emotion express karne dein aur screen time kam karein.",
    "Seek counseling if behavior swings or school withdrawal is observed.": "Agar behavior change ho toh psychiatrist se consult karein.",
    "1. Care: Deep breathing exercises (4-7-8 method), limit screens, drink warm chamomile tea.": "1. Care: Deep breathing karein (4-7-8 method), screen limited karein, warm chamomile tea lein.",
    "2. Activity: Moderate physical exercise (15-min walk).": "2. Activity: Light exercise ya 15 min walk karein.",
    "Avoid self-prescribing sedative pills.": "Neend ki pills khud se na lein.",
    "1. Care: Practice light stretching, gentle breathing, and connect socially with family.": "1. Care: Stretching karein aur family ke sath time spend karein.",
    "2. Environment: Keep sleep environments quiet and dark.": "2. Environment: Sleep room ko dark aur quiet rakhein.",
    "Insomnia or anxiety in seniors is often linked to medication side-effects or vascular conditions. Consult a geriatrician.": "Seniors me anxiety medicine side effects ki wajah se ho sakti hai, doctor se consult karein.",
    "Ensure rest, keep the child hydrated with water/soups, and consult a Pediatrician for weight-appropriate medications.": "Rest karein, bacche ko paani/soup pilayein, aur pediatrician se confirm karke hi medicine dein.",
    "Ensure rest, keep hydrated, monitor temperature, and consult a General Physician.": "Rest karein, hydrated rahein, temperature check karein, aur General Physician ko dikhayein.",
    "Rest, monitor vital signs (BP, temperature), keep hydrated, and consult a Geriatric General Physician.": "Rest karein, BP-temp check karein, paani peeyein aur geriatric physician se consult karein."
  }
};

const translateText = (text, lang) => {
  if (!text || lang === 'en') return text;
  const clean = text.trim();
  if (DIAGNOSTIC_TRANSLATIONS[lang] && DIAGNOSTIC_TRANSLATIONS[lang][clean]) {
    return DIAGNOSTIC_TRANSLATIONS[lang][clean];
  }
  
  if (clean.includes('\n')) {
    return clean.split('\n').map(line => {
      const trimmedLine = line.trim();
      const match = Object.keys(REMEDY_TRANSLATIONS[lang] || {}).find(key => 
        trimmedLine === key || trimmedLine.startsWith(key) || key.startsWith(trimmedLine)
      );
      if (match) {
        return (REMEDY_TRANSLATIONS[lang] || {})[match];
      }
      return line;
    }).join('\n');
  }

  if (REMEDY_TRANSLATIONS[lang]) {
    const match = Object.keys(REMEDY_TRANSLATIONS[lang]).find(key => 
      clean === key || clean.startsWith(key) || key.startsWith(clean)
    );
    if (match) {
      return REMEDY_TRANSLATIONS[lang][match];
    }
  }
  
  return text;
};

function App() {
  // Navigation & User Session State
  const [currentView, setCurrentView] = useState('LANDING'); // LANDING, LOGIN, SIGNUP, VERIFY, DASHBOARD
  const [token, setToken] = useState(localStorage.getItem('medi_token') || '');
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('medi_user') || '');
  const [language, setLanguage] = useState(localStorage.getItem('medi_lang') || 'en');

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('medi_lang', lang);
  };

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // App States
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState('male'); // male, female, other
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Chatbot State Variables
  const [dashboardTab, setDashboardTab] = useState('ANALYZER'); // ANALYZER, CHATBOT
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const chatEndRef = React.useRef(null);

  
  // Alert/Feedback States
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailNotification, setEmailNotification] = useState(''); // Simulated Email alert
  const [fallbackOtp, setFallbackOtp] = useState(''); // Simulated OTP
  const [darkMode, setDarkMode] = useState(false); // Default to light mode for maximum legibility and clear contrast, user can toggle
  const [healthStatus, setHealthStatus] = useState({ online: false, db: 'disconnected' });

  // Quick symptom tags for easy testing
  const quickTags = [
    { key: 'tagChestPain', value: 'I have severe chest pain and short breath' },
    { key: 'tagFeverCough', value: 'High fever, dry cough and mild body pain' },
    { key: 'tagSkinAllergy', value: 'Red skin rash and continuous itching' },
    { key: 'tagToothache', value: 'Severe tooth pain in the upper gum' },
    { key: 'tagEyeBlur', value: 'Red eyes and blurry vision' },
    { key: 'tagStomachAcid', value: 'Stomach pain, acidity, and nausea' },
    { key: 'tagAnxiety', value: 'Feeling constant stress, anxiety and lack of sleep' },
  ];

  // Turnstile Captcha verification removed for seamless login flow

  // Check backend and DB health
  const checkHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus({
          online: true,
          db: data.database?.status === 'connected' ? 'connected' : 'disconnected'
        });
      } else {
        setHealthStatus({ online: false, db: 'disconnected' });
      }
    } catch (err) {
      setHealthStatus({ online: false, db: 'disconnected' });
    }
  };

  // Fetch prediction history for logged in user
  const fetchHistory = async (userToken) => {
    const activeToken = userToken || token;
    if (!activeToken) return;

    try {
      const response = await fetch(`${BACKEND_URL}/history`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        console.error('Failed to fetch prediction history');
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // Fetch agent chat logs history
  const fetchChatHistory = async (userToken) => {
    const activeToken = userToken || token;
    if (!activeToken) return;

    try {
      const response = await fetch(`${BACKEND_URL}/agent/history`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  // Send message to the wellness chatbot agent
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    const cleanMsg = chatInput.trim();
    if (!cleanMsg && !selectedFile) return;

    const fileToUpload = selectedFile;
    const userMessage = { 
      role: 'user', 
      content: cleanMsg || translations[language].uploadedReportLabel.replace('{fileName}', fileToUpload.name),
      file_name: fileToUpload ? fileToUpload.name : null 
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setSelectedFile(null);
    setChatLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', cleanMsg || (language === 'hi' ? `अपलोड की गई रिपोर्ट का विश्लेषण करें: ${fileToUpload.name}` : language === 'hinglish' ? `Uploaded report ko analyze karein: ${fileToUpload.name}` : `Analyze the uploaded report: ${fileToUpload.name}`));
      formData.append('language', language);
      if (fileToUpload) {
        formData.append('file', fileToUpload);
      }

      const response = await fetch(`${BACKEND_URL}/agent/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to get agent response.');
      }
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Connection Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };


  useEffect(() => {
    checkHealth();
    
    // Check if session token already exists
    if (token) {
      setCurrentView('DASHBOARD');
      fetchHistory(token);
      fetchChatHistory(token);
    }
    
    const interval = setInterval(() => {
      checkHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading]);


  // Handle Sign Up (Triggers OTP)

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed. Please try again.');
      }

      setSuccessMessage(data.message || `✅ Verification code sent to ${cleanEmail}. Please check your inbox.`);
      setCurrentView('VERIFY');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (otp.length !== 4) {
      setErrorMessage('Please enter the 4-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'OTP verification failed.');
      }

      localStorage.setItem('medi_token', data.token);
      localStorage.setItem('medi_user', email.trim().toLowerCase());
      setToken(data.token);
      setCurrentUser(email.trim().toLowerCase());
      setEmailNotification('');
      setCurrentView('DASHBOARD');
      fetchHistory(data.token);
      fetchChatHistory(data.token);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed. Please check credentials.');
      }

      localStorage.setItem('medi_token', data.token);
      localStorage.setItem('medi_user', email.trim().toLowerCase());
      setToken(data.token);
      setCurrentUser(email.trim().toLowerCase());
      setCurrentView('DASHBOARD');
      fetchHistory(data.token);
      fetchChatHistory(data.token);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('medi_token');
    localStorage.removeItem('medi_user');
    setToken('');
    setCurrentUser('');
    setEmail('');
    setPassword('');
    setOtp('');
    setResult(null);
    setHistory([]);
    setChatMessages([]);
    setChatInput('');
    setChatLoading(false);
    setSelectedFile(null);
    setDashboardTab('ANALYZER');
    setErrorMessage('');
    setSuccessMessage('');
    setEmailNotification('');
    setCurrentView('LOGIN');
  };


  // Handle Symptom Diagnosis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setResult(null);

    const trimmedSymptoms = symptoms.trim();
    if (!trimmedSymptoms) {
      setErrorMessage('Please enter your symptoms to begin.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ symptoms: trimmedSymptoms, age, gender }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to analyze symptoms.');
      }

      setResult(data);
      fetchHistory(token);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Set symptoms from quick tag
  const handleTagClick = (val) => {
    setSymptoms(val);
    setErrorMessage('');
  };

  // Format timestamp
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      
      {/* 3D Grid Overlay Background */}
      <div className="three-d-grid-overlay"></div>
      
      {/* Floating Medical Cross Particles */}
      <div className="floating-crosses-container" aria-hidden="true">
        <span className="floating-cross cross-1">+</span>
        <span className="floating-cross cross-2">+</span>
        <span className="floating-cross cross-3">+</span>
        <span className="floating-cross cross-4">+</span>
        <span className="floating-cross cross-5">+</span>
      </div>

      {/* Header Panel */}
      <header className="app-header">
        <div className="header-logo" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('LANDING')}>
          <svg className="logo-icon animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="logo-text">{translations[language].appName}</span>
        </div>

        <div className="nav-links-container">
          <span 
            className={`nav-link-item ${currentView === 'LANDING' ? 'active' : ''}`}
            onClick={() => setCurrentView('LANDING')}
          >
            {translations[language].home}
          </span>
          {token ? (
            <span 
              className={`nav-link-item ${currentView === 'DASHBOARD' ? 'active' : ''}`}
              onClick={() => setCurrentView('DASHBOARD')}
            >
              {translations[language].dashboard}
            </span>
          ) : (
            <>
              <span 
                className={`nav-link-item ${currentView === 'LOGIN' ? 'active' : ''}`}
                onClick={() => setCurrentView('LOGIN')}
              >
                {translations[language].login}
              </span>
              <span 
                className={`nav-link-item ${currentView === 'SIGNUP' ? 'active' : ''}`}
                onClick={() => setCurrentView('SIGNUP')}
              >
                {translations[language].signup}
              </span>
            </>
          )}
        </div>

        <div className="header-controls">
          {/* Health indicator */}
          <div className="service-status-dropdown">
            <div className="health-badge-3d" style={{ cursor: 'help' }}>
              <span className={`status-dot ${healthStatus.online ? 'online' : 'offline'}`}></span>
              <span className="health-text">
                {translations[language].serviceStatusLabel.replace(':', '')}: {healthStatus.online ? (healthStatus.db === 'connected' ? (translations[language].active || 'Active') : (translations[language].degraded || 'Degraded')) : translations[language].offline}
              </span>
            </div>
            <div className="service-status-tooltip">
              <div className="tooltip-status-item">
                <span>{translations[language].serviceStatusLabel}</span>
                <span className={healthStatus.online ? 'primary-text' : 'remedy-caution-3d'} style={{ color: healthStatus.online ? '#0e7490' : '#ef4444' }}>
                  {healthStatus.online ? translations[language].online : translations[language].offline}
                </span>
              </div>
              <div className="tooltip-status-item">
                <span>{translations[language].dbStoreLabel}</span>
                <span className={healthStatus.db === 'connected' ? 'primary-text' : 'remedy-caution-3d'} style={{ color: healthStatus.db === 'connected' ? '#10b981' : '#ef4444' }}>
                  {healthStatus.db === 'connected' ? translations[language].connected : translations[language].disconnected}
                </span>
              </div>
            </div>
          </div>

          {/* Language Selector */}
          <div className="language-selector-container">
            <span className="lang-icon">🌐</span>
            <select 
              value={language} 
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="language-select-dropdown-3d"
              aria-label="Select Language"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          {/* Theme toggle */}
          <button 
            className="theme-toggle-3d" 
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle light/dark theme"
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Logged in User state */}
          {token && (
            <div className="session-logout-panel">
              <span className="user-indicator">👤 {currentUser}</span>
              <button className="logout-btn-3d" onClick={handleLogout}>{translations[language].logout}</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Router */}
      <main className="main-content">
        {/* VIEW 0: LANDING PAGE */}
        {currentView === 'LANDING' && (
          <div className="landing-container animate-fade-in">
            {/* Hero Section */}
            <section className="landing-hero">
              <div className="hero-content fade-in-up">
                <span className="hero-badge">{translations[language].badge}</span>
                <h1>{translations[language].heroTitle}</h1>
                <p className="subtitle">
                  {translations[language].heroSubtitle}
                </p>
                <div className="hero-actions">
                  <button 
                    className="hero-btn-primary" 
                    onClick={() => {
                      if (token) {
                        setCurrentView('DASHBOARD');
                      } else {
                        setCurrentView('SIGNUP');
                      }
                    }}
                  >
                    {translations[language].initPortal}
                  </button>
                  <button 
                    className="hero-btn-secondary" 
                    onClick={() => {
                      if (token) {
                        setCurrentView('DASHBOARD');
                        setDashboardTab('CHATBOT');
                      } else {
                        setCurrentView('LOGIN');
                      }
                    }}
                  >
                    {translations[language].consultWellness}
                  </button>
                </div>
              </div>
              <div className="hero-illustration" aria-hidden="true">
                <div className="hero-glow-sphere"></div>
                <div className="hero-security-card" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem', fontWeight: '800' }}>{translations[language].securityTitle}</strong>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(14, 116, 144, 0.15)', color: 'var(--primary)', borderRadius: '4px', fontWeight: '700', border: '1px solid var(--primary)' }}>{translations[language].secureStatus}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{translations[language].diagProtocol}</span>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{translations[language].privateSession}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{translations[language].dbLifecycle}</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{translations[language].dbClusters}</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Services Grid Section */}
            <section className="landing-services-section">
              <div className="section-header-3d">
                <h2>{translations[language].servicesHeading}</h2>
                <p>{translations[language].servicesSubtitle}</p>
              </div>

              <div className="services-grid-3d">
                {/* Service 1 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">🩺</div>
                  <h3>{translations[language].service1Title}</h3>
                  <p>{translations[language].service1Desc}</p>
                  <span className="service-card-tag">{translations[language].service1Tag}</span>
                </div>

                {/* Service 2 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">🤖</div>
                  <h3>{translations[language].service2Title}</h3>
                  <p>{translations[language].service2Desc}</p>
                  <span className="service-card-tag">{translations[language].service2Tag}</span>
                </div>

                {/* Service 3 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">🗺️</div>
                  <h3>{translations[language].service3Title}</h3>
                  <p>{translations[language].service3Desc}</p>
                  <span className="service-card-tag">{translations[language].service3Tag}</span>
                </div>

                {/* Service 4 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">📊</div>
                  <h3>{translations[language].service4Title}</h3>
                  <p>{translations[language].service4Desc}</p>
                  <span className="service-card-tag">{translations[language].service4Tag}</span>
                </div>

                {/* Service 5 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">📧</div>
                  <h3>{translations[language].service5Title}</h3>
                  <p>{translations[language].service5Desc}</p>
                  <span className="service-card-tag">{translations[language].service5Tag}</span>
                </div>

                {/* Service 6 */}
                <div className="service-card-3d">
                  <div className="service-icon-wrapper">📄</div>
                  <h3>{translations[language].service6Title}</h3>
                  <p>{translations[language].service6Desc}</p>
                  <span className="service-card-tag">{translations[language].service6Tag}</span>
                </div>
              </div>
            </section>

            {/* Timeline: How it Works */}
            <section className="how-it-works-section">
              <div className="section-header-3d">
                <h2>{translations[language].timelineHeading}</h2>
                <p>{translations[language].timelineSubtitle}</p>
              </div>

              <div className="timeline-3d">
                <div className="timeline-step-3d">
                  <span className="step-num-3d">1</span>
                  <h4>{translations[language].step1Title}</h4>
                  <p>{translations[language].step1Desc}</p>
                </div>

                <div className="timeline-step-3d">
                  <span className="step-num-3d">2</span>
                  <h4>{translations[language].step2Title}</h4>
                  <p>{translations[language].step2Desc}</p>
                </div>

                <div className="timeline-step-3d">
                  <span className="step-num-3d">3</span>
                  <h4>{translations[language].step3Title}</h4>
                  <p>{translations[language].step3Desc}</p>
                </div>

                <div className="timeline-step-3d">
                  <span className="step-num-3d">4</span>
                  <h4>{translations[language].step4Title}</h4>
                  <p>{translations[language].step4Desc}</p>
                </div>
              </div>
            </section>

            {/* CTA Bottom Banner */}
            <section className="landing-cta-bottom">
              <h2>{translations[language].ctaTitle}</h2>
              <p>{translations[language].ctaDesc}</p>
              <button 
                className="cta-btn-white" 
                onClick={() => {
                  if (token) {
                    setCurrentView('DASHBOARD');
                  } else {
                    setCurrentView('SIGNUP');
                  }
                }}
              >
                {translations[language].ctaButton}
              </button>
            </section>
          </div>
        )}

        {/* VIEW 1: LOGIN PORTAL */}
        {currentView === 'LOGIN' && (
          <div className="auth-container">
            <section className="glass-card auth-card-3d">
              <div className="card-glow-border"></div>
              <div className="auth-header">
                <h2>{translations[language].loginTitle}</h2>
                <p className="subtitle">{translations[language].loginSubtitle}</p>
              </div>

              <form onSubmit={handleLogin} className="auth-form">
                <div className="form-group-3d">
                  <label htmlFor="login-email">{translations[language].emailLabel}</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder={translations[language].emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input-3d"
                    required
                  />
                </div>

                <div className="form-group-3d">
                  <label htmlFor="login-pass">{translations[language].passwordLabel}</label>
                  <input
                    id="login-pass"
                    type="password"
                    placeholder={translations[language].passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input-3d"
                    required
                  />
                </div>

                {/* Human Verification CAPTCHA has been removed */}

                {errorMessage && <div className="error-alert-3d">⚠️ {errorMessage}</div>}

                <button type="submit" className="submit-btn-3d font-bold" disabled={loading}>
                  {loading ? translations[language].authenticating : translations[language].loginBtn}
                </button>

                <p className="auth-footer-link">
                  {translations[language].toSignupLabel}
                  <span onClick={() => { setCurrentView('SIGNUP'); setErrorMessage(''); setSuccessMessage(''); }}>
                    {translations[language].toSignupLink}
                  </span>
                </p>
              </form>
            </section>
          </div>
        )}

        {/* VIEW 2: SIGN UP PORTAL */}
        {currentView === 'SIGNUP' && (
          <div className="auth-container">
            <section className="glass-card auth-card-3d">
              <div className="card-glow-border"></div>
              <div className="auth-header">
                <h2>{translations[language].signupTitle}</h2>
                <p className="subtitle">{translations[language].signupSubtitle}</p>
              </div>

              <form onSubmit={handleSignup} className="auth-form">
                <div className="form-group-3d">
                  <label htmlFor="signup-email">{translations[language].emailLabel}</label>
                  <input
                    id="signup-email"
                    type="email"
                    placeholder={translations[language].emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input-3d"
                    required
                  />
                </div>

                <div className="form-group-3d">
                  <label htmlFor="signup-pass">{translations[language].passwordLabel}</label>
                  <input
                    id="signup-pass"
                    type="password"
                    placeholder={translations[language].signupPasswordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input-3d"
                    required
                  />
                </div>

                {errorMessage && <div className="error-alert-3d">⚠️ {errorMessage}</div>}

                <button type="submit" className="submit-btn-3d" disabled={loading}>
                  {loading ? translations[language].processing : translations[language].signupBtn}
                </button>

                <p className="auth-footer-link">
                  {translations[language].toLoginLabel}
                  <span onClick={() => { setCurrentView('LOGIN'); setErrorMessage(''); setSuccessMessage(''); }}>
                    {translations[language].toLoginLink}
                  </span>
                </p>
              </form>
            </section>
          </div>
        )}

        {/* VIEW 3: OTP VERIFICATION VIEW */}
        {currentView === 'VERIFY' && (
          <div className="auth-container">
            <section className="glass-card auth-card-3d">
              <div className="card-glow-border"></div>
              <div className="auth-header">
                <h2>{translations[language].verifyTitle}</h2>
                <p className="subtitle">
                  {translations[language].verifySubtitle}
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div className="form-group-3d">
                  <label htmlFor="otp-input">{translations[language].otpLabel}</label>
                  <input
                    id="otp-input"
                    type="text"
                    maxLength="4"
                    placeholder="1234"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="otp-field-input-3d"
                    required
                  />
                </div>

                {successMessage && <div className="success-alert-3d">✓ {successMessage}</div>}
                {errorMessage && <div className="error-alert-3d">⚠️ {errorMessage}</div>}

                <button type="submit" className="submit-btn-3d" disabled={loading}>
                  {loading ? translations[language].verifying : translations[language].verifyBtn}
                </button>

                <p className="auth-footer-link">
                  <span onClick={() => { setOtp(''); handleSignup(new Event('submit')); }}>
                    {translations[language].resendOtp}
                  </span>
                </p>
              </form>
            </section>
          </div>
        )}


        {/* VIEW 4: DIAGNOSTIC DASHBOARD (LOGGED-IN VIEW) */}
        {currentView === 'DASHBOARD' && (
          <div className="dashboard-wrapper-3d animate-fade-in">
            
            {/* Dashboard Sub-navigation Tabs */}
            <div className="dashboard-navigation-tabs">
              <button 
                className={`tab-navigation-btn ${dashboardTab === 'ANALYZER' ? 'active' : ''}`}
                onClick={() => setDashboardTab('ANALYZER')}
              >
                {translations[language].tabAnalyzer}
              </button>
              <button 
                className={`tab-navigation-btn ${dashboardTab === 'CHATBOT' ? 'active' : ''}`}
                onClick={() => {
                  setDashboardTab('CHATBOT');
                  fetchChatHistory();
                }}
              >
                {translations[language].tabChatbot}
              </button>
            </div>

            {dashboardTab === 'ANALYZER' ? (
              <div className="grid-layout">
                
                {/* Left Panel: Analyzer Form */}
                <div className="analyzer-panel">

              <section className="glass-card main-card-3d">
                <div className="card-glow-border"></div>
                <div className="card-header">
                  <h2>{translations[language].analyzerTitle}</h2>
                  <p className="subtitle">{translations[language].analyzerSubtitle}</p>
                </div>

                <form onSubmit={handleAnalyze} className="analyzer-form">
                  
                  {/* Age Input with Interactive Range Slider and Segmented Gender Controls */}
                  <div className="demographics-row-3d">
                    
                    <div className="form-group-age-3d">
                      <label htmlFor="patient-age" className="age-label-3d">{translations[language].patientAgeLabel} <strong className="primary-text">{age} {translations[language].years}</strong></label>
                      <div className="age-input-wrapper-3d">
                        <input
                          id="patient-age"
                          type="range"
                          min="1"
                          max="100"
                          value={age}
                          onChange={(e) => setAge(parseInt(e.target.value))}
                          className="age-slider-3d"
                          style={{
                            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${age}%, var(--border-color) ${age}%, var(--border-color) 100%)`
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group-gender-3d">
                      <label className="gender-label-3d">{translations[language].patientGenderLabel}</label>
                      <div className="gender-segmented-control">
                        <button
                          type="button"
                          className={`gender-segment-btn ${gender === 'male' ? 'active' : ''}`}
                          onClick={() => setGender('male')}
                        >
                          {translations[language].genderMale}
                        </button>
                        <button
                          type="button"
                          className={`gender-segment-btn ${gender === 'female' ? 'active' : ''}`}
                          onClick={() => setGender('female')}
                        >
                          {translations[language].genderFemale}
                        </button>
                        <button
                          type="button"
                          className={`gender-segment-btn ${gender === 'other' ? 'active' : ''}`}
                          onClick={() => setGender('other')}
                        >
                          {translations[language].genderOther}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Dynamic gender-aware demographic card avatar */}
                  <div className="dynamic-avatar-box">
                    <span className={`dynamic-avatar-emoji age-category-${age <= 12 ? 'child' : age >= 65 ? 'elder' : 'adult'}`}>
                      {(() => {
                        if (age <= 12) {
                          if (gender === 'male') return '👦';
                          if (gender === 'female') return '👧';
                          return '👶';
                        } else if (age >= 65) {
                          if (gender === 'male') return '👴';
                          if (gender === 'female') return '👵';
                          return '🧓';
                        } else {
                          if (gender === 'male') return '👨';
                          if (gender === 'female') return '👩';
                          return '🧑';
                        }
                      })()}
                    </span>
                    <div className="avatar-info-panel">
                      <span className="avatar-category-name">
                        {age <= 12 ? translations[language].childAvatar : age >= 65 ? translations[language].seniorAvatar : translations[language].adultAvatar}
                      </span>
                      <span className="avatar-category-range">
                        {age <= 12 ? translations[language].childRange : age >= 65 ? translations[language].seniorRange : translations[language].adultRange}
                      </span>
                    </div>
                  </div>

                  {/* Symptoms Textarea */}
                  <div className="textarea-container-3d">
                    <label htmlFor="symptom-input" className="symptom-label-3d">{translations[language].describeSymptomsLabel}</label>
                    <div className="textarea-inner-wrapper">
                      <textarea
                        id="symptom-input"
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder={translations[language].symptomsPlaceholder}
                        className="symptom-textarea-3d"
                        rows="4"
                      />
                      {symptoms && (
                        <button 
                          type="button" 
                          className="clear-button-3d" 
                          onClick={() => setSymptoms('')}
                          title="Clear input"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {errorMessage && <div className="error-alert-3d">⚠️ {errorMessage}</div>}

                  {/* Two-Column action & presets layout directly below description */}
                  <div className="action-presets-split-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', marginTop: '0.8rem', alignItems: 'start' }}>
                    
                    {/* Left side: Submit button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{translations[language].runEngine}</span>
                      <button 
                        type="submit" 
                        className="submit-btn-3d" 
                        disabled={loading}
                        style={{ width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', border: 'none', transition: 'all 0.2s ease', minHeight: '48px' }}
                      >
                        {loading ? (
                          <span className="loader-container" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span className="spinner"></span>
                            {translations[language].analyzingText}
                          </span>
                        ) : (
                          <span className="btn-content" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.95rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.1rem', height: '1.1rem' }}>
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {translations[language].analyzeBtn}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Right side: Quick Presets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{translations[language].presetsLabel}</span>
                      <div className="tags-list-3d" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {quickTags.map((tag, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="tag-btn-3d"
                            onClick={() => handleTagClick(tag.value)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', whiteSpace: 'nowrap' }}
                          >
                            {translations[language][tag.key]}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </form>
              </section>
            </div>

            {/* Right Panel: Result OR History Logs */}
            <div className="history-panel">
              {result ? (
                /* Analysis Result Card - Formatted Clinical Compartments */
                <section className={`glass-card result-card-3d ${result.risk}-glow-active`} style={{ marginBottom: 0 }}>
                  
                  {/* Premium Diagnostic Header */}
                  <div className="result-header-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{translations[language].diagnosticVerdictTitle}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{translations[language].diagnosticVerdictSub}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className={`mini-badge-3d ${result.risk}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', fontWeight: '800' }}>
                        {result.risk === 'Emergency' ? '🚨' : result.risk === 'Urgent' ? '⚠️' : '✅'} {translateText(result.risk, language)} {translations[language].riskBadge}
                      </span>
                      <button 
                        className="clear-button-3d" 
                        type="button"
                        onClick={() => setResult(null)} 
                        title="Clear Result" 
                        style={{ position: 'static', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* COMPARTMENT 2: CLINICAL VERDICT & SCHEDULING */}
                  <div className="clinical-compartment verdict-scheduling-compartment">
                    <div className="compartment-header">
                      <span className="icon-pulse">⚕️</span>
                      <h3>{translations[language].clinicalVerdictRouting}</h3>
                    </div>
                    <div className="verdict-grid">
                      <div className="specialist-suggestion-3d">
                        <span className="body-label-3d">{translations[language].suggestedSpecialistLabel}</span>
                        <p className="doctor-name-3d">{translateText(result.doctor, language)}</p>
                      </div>
                      {result.contact && (
                        <div className="contact-suggestion-3d">
                          <h4>{translations[language].hotlineAppointmentLabel}</h4>
                          <p className="contact-phone-3d">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="phone-icon-3d">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <a href={`tel:${result.contact.split(' ')[0]}`} className="phone-link-3d">
                              {result.contact}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {result.risk === 'Emergency' && (
                      <div className="emergency-alert-3d">
                        <div className="emergency-icon-container-3d">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="emergency-icon-3d">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </div>
                        <p className="emergency-text-3d">
                          {translations[language].emergencyWarningText}
                        </p>
                      </div>
                    )}
                    
                    <div className="result-actions-3d" style={{ flexDirection: 'column', gap: '1.2rem', alignItems: 'stretch', width: '100%' }}>
                      <OpenStreetMapComponent doctorSpecialist={result.doctor} language={language} />
                    </div>
                  </div>

                  {/* COMPARTMENT 3: TREATMENT & HOME CARE ALERTS */}
                  <div className="clinical-compartment home-care-compartment">
                    <div className="compartment-header">
                      <span className="icon-pulse">💊</span>
                      <h3>{translations[language].treatmentGuidelinesLabel}</h3>
                    </div>
                    <div className="advice-section-3d">
                      <h4>{translations[language].directivesAdviceLabel}</h4>
                      <p className="advice-text-3d">{translateText(result.advice, language)}</p>
                    </div>

                    {result.home_remedies && (
                      <div className="home-remedies-section-3d">
                        <h4>{translations[language].standardHomeCareLabel}</h4>
                        <div className="remedies-container-3d">
                          {translateText(result.home_remedies, language).split('\n').map((line, idx) => {
                            const isCaution = line.trim().startsWith('*');
                            return (
                              <p key={idx} className={isCaution ? 'remedy-caution-3d' : 'remedy-line-3d'}>
                                {isCaution ? line.replace(/^\*\s*/, '') : line}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </section>
              ) : (
                /* History Logs */
                <section className="glass-card history-card-container-3d">
                  <div className="card-glow-border"></div>
                  <div className="history-header">
                    <h3>Personal Diagnosis History</h3>
                    <button 
                      className="refresh-btn-3d" 
                      onClick={() => fetchHistory(token)} 
                      title="Refresh cases"
                      aria-label="Refresh"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                    </button>
                  </div>

                  <div className="history-list">
                    {history.length === 0 ? (
                      <div className="empty-history">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-icon">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <p>No recent case records found.</p>
                        <p className="subtext">Completed logs will register here dynamically.</p>
                      </div>
                    ) : (
                      history.map((item) => (
                        <div key={item._id} className="history-item-3d">
                          <div className="history-item-top">
                            <span className={`mini-badge-3d ${item.risk}`}>{item.risk}</span>
                            <span className="history-time">{formatTime(item.timestamp)}</span>
                          </div>
                          <div className="history-item-body">
                            <p className="history-symptoms"><strong>Symptoms:</strong> {item.symptoms} {item.age !== undefined && <span className="history-item-age-3d">({item.gender === 'female' ? '👩' : item.gender === 'male' ? '👨' : '🧑'} {item.age} yrs)</span>}</p>
                            <p className="history-suggestion"><strong>Specialist:</strong> {item.doctor}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
            
          </div>
        ) : (
          <div className="chatbot-console-container-3d animate-fade-in">
            <section className="glass-card chatbot-card-3d">
              <div className="card-glow-border"></div>
              
              <div className="chatbot-header">
                <div className="chatbot-header-info">
                  <span className="chatbot-badge-3d">Wellness AI</span>
                  <h2>Clinical Wellness & Diet Agent</h2>
                  <p className="subtitle">Ask about diet plans, food items to include or avoid, lifestyle changes, and general health tips based on your condition.</p>
                </div>
              </div>

              <div className="chat-messages-box">
                {chatMessages.length === 0 ? (
                  <div className="empty-chat-state">
                    <span className="empty-chat-icon animate-pulse">💬</span>
                    <p className="empty-chat-main-text">Start consulting with MediGuard AI Agent</p>
                    <p className="empty-chat-sub-text">Type a query below or select a quick starter prompt. The agent will analyze and suggest healthy guidelines.</p>
                    
                    <div className="chat-presets-list">
                      <button type="button" className="chat-preset-btn" onClick={() => setChatInput("What should I eat when feeling high acidity and heartburn?")}>
                        🍋 Diet for Acidity
                      </button>
                      <button type="button" className="chat-preset-btn" onClick={() => setChatInput("Can you suggest a diet plan and lifestyle advice for high fever?")}>
                        🍵 Lifestyle for Fever
                      </button>
                      <button type="button" className="chat-preset-btn" onClick={() => setChatInput("What foods should I avoid if I suspect pregnancy menstrual cramps?")}>
                        🤰 Women's Health Diet
                      </button>
                      <button type="button" className="chat-preset-btn" onClick={() => setChatInput("Can you suggest stress relief and dietary recommendations for insomnia/lack of sleep?")}>
                        💤 Rest & Sleep Guidelines
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}>
                      <div className={`chat-message-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                        <span className="chat-sender-avatar">
                          {msg.role === 'user' ? '👤' : '🤖'}
                        </span>
                        <div className="chat-message-content">
                          {msg.file_name && (
                            <div className="chat-attachment-pill-display">
                              <span className="attachment-icon">📎</span>
                              <span className="attachment-filename">{msg.file_name}</span>
                            </div>
                          )}
                          {msg.content.split('\n').map((line, lIdx) => {
                            if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                              return <li key={lIdx} className="chat-msg-li">{line.replace(/^[\*\-]\s*/, '')}</li>;
                            }
                            return <p key={lIdx} className="chat-msg-p">{line}</p>;
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {chatLoading && (
                  <div className="chat-message-row assistant-row">
                    <div className="chat-message-bubble assistant-bubble typing-bubble">
                      <span className="chat-sender-avatar animate-spin">⚕️</span>
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {selectedFile && (
                <div className="chat-upload-preview-container-3d">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" className="remove-file-btn" onClick={() => setSelectedFile(null)}>✕</button>
                </div>
              )}

              <form onSubmit={handleSendChatMessage} className="chat-input-form-3d">
                <input
                  type="file"
                  id="chat-file-upload"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  accept="image/*,application/pdf,text/plain"
                />
                <label htmlFor="chat-file-upload" className="chat-attach-btn-3d" title="Attach Medical Report (PDF, Image, Text)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attach-icon-3d">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </label>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={chatLoading ? "AI Agent is compiling recommendation..." : "Ask Wellness AI about foods, diet or lifestyle advice..."}
                  className="chat-text-input-3d"
                  disabled={chatLoading}
                  required={!selectedFile}
                />
                <button type="submit" className="chat-send-btn-3d" disabled={chatLoading || (!chatInput.trim() && !selectedFile)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="send-icon-3d">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </section>
          </div>
        )}
        
      </div>
    )}

      </main>

      {/* Footer / Disclaimer */}
      <footer className="app-footer">
        <p className="disclaimer-text">
          ⚠️ <strong>Regulatory Disclaimer:</strong> This engine provides advisory specialisation matching and home care OTC references. It does NOT provide diagnostic, medical, or prescription verdicts. For any acute pain or life-threatening situation, alert emergency paramedics (108/112) or reach your closest emergency ward immediately.
        </p>
        <p className="copyright-text">© {new Date().getFullYear()} MediGuard AI - Clinical Decision Support Platform</p>
      </footer>
    </div>
  );
}

export default App;
