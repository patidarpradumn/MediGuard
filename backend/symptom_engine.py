def analyze_symptoms(symptoms_text, age: int, gender: str = "male"):
    symptoms = symptoms_text.lower()
    
    # Classify age group
    if age <= 12:
        age_group = "child"
    elif age >= 65:
        age_group = "elderly"
    else:
        age_group = "adult"

    # Female-specific Gynecological matches
    if gender.lower() == "female":
        female_keywords = ["periods", "pregnancy", "menstrual", "gynec", "cramps", "pregnancy test", "period pain"]
        for word in female_keywords:
            if word in symptoms:
                risk = "Normal"
                if age_group == "elderly":
                    risk = "Urgent" # Elevate for elderly safety
                return {
                    "doctor": "Gynecologist & Obstetrician",
                    "risk": risk,
                    "advice": "Ensure adequate hydration, take warm baths for cramps, and consult a Gynecologist if symptoms persist or if you suspect pregnancy.",
                    "matched_symptom": word,
                    "contact": "+91 98765 00999 (Women's Wellness Clinic)",
                    "home_remedies": "1. Standard Care: Use hot water bag on the lower abdomen for cramp relief. Sip warm ginger or chamomile tea.\n2. Pain relief: Paracetamol 500mg (1 tablet every 6 hours, max 3/day) is safer than Ibuprofen if there is any chance of pregnancy.\n*CAUTION: Avoid NSAIDs (like Ibuprofen/Aspirin) if pregnancy is possible without doctor approval. Seek urgent care if abdominal pain is severe and sudden.*"
                }

    emergency_keywords = [
        "chest pain", "breathing problem", "shortness of breath",
        "unconscious", "heavy bleeding", "severe accident", "stroke",
        "heart attack", "seizure"
    ]

    # Check emergency first (Emergency applies to all age groups)
    for word in emergency_keywords:
        if word in symptoms:
            # Special advisory for children and elderly in emergency
            if age_group == "child":
                contact = "+91 98765 00505 (Pediatric ER) / 108 (Ambulance)"
                remedies = "1. NO SELF-MEDICATION: Do NOT give any adult pills or child syrups. \n2. Action: Keep the child calm, upright, and transport to the nearest Pediatric Emergency Room immediately."
            elif age_group == "elderly":
                contact = "+91 98765 00505 (Cardiac ER) / 108 (Ambulance)"
                remedies = "1. NO SELF-MEDICATION: Avoid administering high-dose aspirin or other drugs without emergency dispatch approval. \n2. Action: Help the patient rest in a comfortable semi-reclining position, keep warm, and monitor breathing until help arrives."
            else:
                contact = "+91 98765 00505 (Cardiac ER) / 108 (Ambulance)"
                remedies = "1. NO SELF-MEDICATION: Do NOT take any pain relievers or generic tablets as it may interact dangerously with emergency treatments.\n2. Action: Loosen tight clothing, sit upright, keep airways clear, and seek emergency hospital transport immediately."

            return {
                "doctor": "Emergency Care / Cardiologist" if age_group != "child" else "Pediatric Emergency Specialist",
                "risk": "Emergency",
                "advice": "This may be an emergency. Please visit the nearest hospital immediately.",
                "matched_symptom": word,
                "contact": contact,
                "home_remedies": remedies
            }

    # Define base rule matches
    rules = [
        {
            "keywords": ["fever", "cold", "cough", "body pain", "weakness", "headache"],
            "risk": "Normal",
            "doctor": {
                "child": "Pediatrician",
                "adult": "General Physician",
                "elderly": "Geriatric General Physician"
            },
            "advice": "Take rest, drink water, and consult a doctor if symptoms continue.",
            "contact": {
                "child": "+91 98765 00808 (Kids Clinic Helpline)",
                "adult": "+91 98765 00101 (GP Appointment Clinic)",
                "elderly": "+91 98765 00909 (Senior Health Center)"
            },
            "home_remedies": {
                "child": "1. Standard Care: Keep hydrated with water and warm soups. Clean nose with saline drops. \n2. OTC: Use Pediatric Paracetamol suspension/syrup (dosage MUST be based on the child's exact weight, check bottle). \n*CAUTION: Never give Aspirin to children due to Reye's Syndrome risk. Seek medical check if fever exceeds 102°F (38.9°C).*",
                "adult": "1. Standard OTC: Paracetamol 500mg - 1 tablet every 4-6 hours as needed (Max: 4 tablets/2000mg per day, after food).\n2. For Cold: Steam inhalation 2 times a day. OTC Cetirizine 10mg (1 tablet at night if nose is runny). \n*CAUTION: Never exceed 4000mg of Paracetamol per day to avoid liver risk.*",
                "elderly": "1. Standard Care: Warm fluids, strict rest, and check temperature. \n2. OTC: Acetaminophen/Paracetamol 325mg or 500mg - 1 tablet (Max: 3 tablets/1500mg per day). \n*CAUTION: Seniors are more sensitive to drug side effects. Avoid NSAIDs (like Ibuprofen) if history of high blood pressure, heart disease, or kidney issues exists.*"
            }
        },
        {
            "keywords": ["skin", "rash", "itching", "allergy", "acne"],
            "risk": "Normal",
            "doctor": {
                "child": "Pediatric Dermatologist",
                "adult": "Dermatologist",
                "elderly": "Dermatologist / Geriatric Specialist"
            },
            "advice": "Avoid scratching and consult a skin specialist.",
            "contact": {
                "child": "+91 98765 00808 (Kids Clinic Helpline)",
                "adult": "+91 98765 00202 (DermaCare Appointment Desk)",
                "elderly": "+91 98765 00909 (Senior Health Center)"
            },
            "home_remedies": {
                "child": "1. Care: Bathe with lukewarm water. Apply cold compresses. \n2. OTC: Apply light Calamine lotion. Ask pediatrician before giving oral antihistamine syrups. \n*CAUTION: Do not let the child scratch to avoid skin infections. Avoid heavily scented lotions.*",
                "adult": "1. OTC: Apply Calamine Lotion locally on the affected skin 3-4 times a day.\n2. For Allergy: OTC Cetirizine 10mg (1 tablet at night) can control itching.\n*CAUTION: Do not apply calamine on open wounds.*",
                "elderly": "1. Care: Apply Calamine lotion or coconut oil to soothe dry, itchy skin.\n2. Hydration: Maintain room humidity and use thick, fragrance-free moisturizers.\n*CAUTION: Antihistamines like Cetirizine can cause increased drowsiness and fall risk in seniors. Use with caution.*"
            }
        },
        {
            "keywords": ["tooth", "teeth", "gum", "dental"],
            "risk": "Normal",
            "doctor": {
                "child": "Pediatric Dentist",
                "adult": "Dentist",
                "elderly": "Dentist"
            },
            "advice": "Avoid very hot or cold food and visit a dentist.",
            "contact": {
                "child": "+91 98765 00808 (Kids Dental Desk)",
                "adult": "+91 98765 00303 (Dental Wellness Clinic)",
                "elderly": "+91 98765 00303 (Dental Wellness Clinic)"
            },
            "home_remedies": {
                "child": "1. Care: Warm water mouth rinse. Gently floss to clear trapped food. \n2. OTC: Pediatric Ibuprofen suspension (only if after meals, weight-based dosage). \n*CAUTION: Do NOT put aspirin pills directly on gums as it burns the tissue. Consult a pediatric dentist.*",
                "adult": "1. OTC: Ibuprofen 400mg - 1 tablet every 6-8 hours as needed (Max: 1200mg/day, always after food).\n2. Rinse mouth with warm salt water 3-4 times a day.\n*CAUTION: Avoid Ibuprofen if history of stomach ulcers or asthma.*",
                "elderly": "1. Care: Warm salt water gargles. Eat soft foods at room temperature.\n2. Pain relief: Paracetamol/Acetaminophen 500mg (1 tablet, max 3/day) is safer than Ibuprofen for senior dental pain.\n*CAUTION: Avoid NSAIDs if taking blood thinners or if suffering from chronic kidney disease.*"
            }
        },
        {
            "keywords": ["eye", "blur", "vision", "red eye"],
            "risk": "Urgent",
            "doctor": {
                "child": "Pediatric Ophthalmologist",
                "adult": "Ophthalmologist",
                "elderly": "Ophthalmologist / Retinal Specialist"
            },
            "advice": "Do not rub your eyes and visit an eye specialist.",
            "contact": {
                "child": "+91 98765 00808 (Kids Eye Helpline)",
                "adult": "+91 98765 00404 (Vision Eye Care Center)",
                "elderly": "+91 98765 00404 (Vision Eye Care Center)"
            },
            "home_remedies": {
                "child": "1. Care: Cover eye with a cool, damp clean cloth. Avoid screens.\n2. Action: Prevent child from rubbing the eyes.\n*CAUTION: Never use adult over-the-counter redness relief drops in children.*",
                "adult": "1. OTC: Lubricating Eye Drops (CMC 0.5%) - 1 to 2 drops in the affected eye 3-4 times a day.\n2. Flush gently with room-temperature water.\n*CAUTION: Discontinue drops and see a doctor if eye pain increases.*",
                "elderly": "1. OTC: Preservative-free lubricating eye drops (artificial tears) to soothe dry eyes.\n2. Safety: Ensure well-lit walkways to prevent falls if vision is blurry.\n*CAUTION: Sudden vision changes in seniors can indicate urgent issues like glaucoma or stroke. Check with an ophthalmologist immediately.*"
            }
        },
        {
            "keywords": ["stomach", "vomiting", "loose motion", "gas", "acidity", "abdominal"],
            "risk": "Normal",
            "doctor": {
                "child": "Pediatrician",
                "adult": "Gastroenterologist",
                "elderly": "Gastroenterologist / Geriatric Physician"
            },
            "advice": "Drink fluids and consult a doctor if pain is severe.",
            "contact": {
                "child": "+91 98765 00808 (Kids Clinic Helpline)",
                "adult": "+91 98765 00606 (Gastro Care Clinic)",
                "elderly": "+91 98765 00909 (Senior Health Center)"
            },
            "home_remedies": {
                "child": "1. Hydration: Sip ORS (Oral Rehydration Solution) or coconut water continuously in small spoonfuls (every 5-10 mins).\n2. Food: Give small amounts of bland foods (banana, curd-rice).\n*CAUTION: Do NOT give anti-diarrheal medicines (like Loperamide) to children as it can be highly dangerous.*",
                "adult": "1. OTC: Antacid Liquid - 10-20ml 30-60 mins after meals. Sip ORS (1 sachet dissolved in 1 Litre water) throughout the day.\n2. Food: Eat light, bland meals.\n*CAUTION: See doctor if vomiting is persistent or blood is noticed.*",
                "elderly": "1. Hydration: Sip warm water, ORS, or weak tea. Seniors dehydrate very rapidly.\n2. Care: Avoid self-prescribing laxatives or antidiarrheal medicines.\n*CAUTION: Abdominal pain in seniors can indicate serious underlying issues. Monitor for low blood pressure or confusion.*"
            }
        },
        {
            "keywords": ["stress", "anxiety", "depression", "panic", "sleep problem"],
            "risk": "Urgent",
            "doctor": {
                "child": "Child Psychologist",
                "adult": "Psychologist / Psychiatrist",
                "elderly": "Geriatric Psychiatrist / Neurologist"
            },
            "advice": "Talk to someone trusted and consult a mental health professional.",
            "contact": {
                "child": "+91 98765 00808 (Child Guidance Desk)",
                "adult": "+91 98765 00707 (Mind & Mental Health Clinic)",
                "elderly": "+91 98765 00909 (Senior Health Center)"
            },
            "home_remedies": {
                "child": "1. Care: Set a consistent comforting routine. Ensure 9-11 hours of sleep. \n2. Action: Encourage emotional expression through drawing or play, and limit screen time.\n*CAUTION: Seek counseling if behavior swings or school withdrawal is observed.*",
                "adult": "1. Care: Deep breathing exercises (4-7-8 method), limit screens, drink warm chamomile tea.\n2. Activity: Moderate physical exercise (15-min walk).\n*CAUTION: Avoid self-prescribing sedative pills.*",
                "elderly": "1. Care: Practice light stretching, gentle breathing, and connect socially with family.\n2. Environment: Keep sleep environments quiet and dark.\n*CAUTION: Insomnia or anxiety in seniors is often linked to medication side-effects or vascular conditions. Consult a geriatrician.*"
            }
        }
    ]

    for rule in rules:
        for word in rule["keywords"]:
            if word in symptoms:
                # Elevate risk level for elderly patients
                risk = rule["risk"]
                if age_group == "elderly" and risk == "Normal":
                    risk = "Urgent"  # Seniors get elevated risk for safety
                
                return {
                    "doctor": rule["doctor"][age_group],
                    "risk": risk,
                    "advice": rule["advice"],
                    "matched_symptom": word,
                    "contact": rule["contact"][age_group],
                    "home_remedies": rule["home_remedies"][age_group]
                }

    # Fallback default recommendations
    fallback_risk = "Normal"
    if age_group == "elderly":
        fallback_risk = "Urgent"

    fallback_doctor = {
        "child": "Pediatrician",
        "adult": "General Physician",
        "elderly": "Geriatric General Physician"
    }

    fallback_contact = {
        "child": "+91 98765 00808 (Kids Clinic Helpline)",
        "adult": "+91 98765 00101 (General Clinic Reception)",
        "elderly": "+91 98765 00909 (Senior Health Center)"
    }

    fallback_remedies = {
        "child": "Ensure rest, keep the child hydrated with water/soups, and consult a Pediatrician for weight-appropriate medications.",
        "adult": "Ensure rest, keep hydrated, monitor temperature, and consult a General Physician.",
        "elderly": "Rest, monitor vital signs (BP, temperature), keep hydrated, and consult a Geriatric General Physician."
    }

    return {
        "doctor": fallback_doctor[age_group],
        "risk": fallback_risk,
        "advice": "Symptoms are not clearly matched. Please consult a specialist for proper guidance.",
        "matched_symptom": "Not matched",
        "contact": fallback_contact[age_group],
        "home_remedies": fallback_remedies[age_group]
    }
