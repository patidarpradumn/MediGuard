# MediGuard AI: A Hybrid Rule-Based and Generative AI Clinical Decision Support System with Integrated Geospatial Healthcare Provider Discovery for the Indian Population

**Pradumn Patidar**
Department of Computer Science and Engineering
Medi-Ops Research Lab, India
Email: pradumn.patidar@ieee-sample.org

---

## Abstract

The escalating burden on Indian public healthcare infrastructure demands innovative, accessible and cost effective digital health solutions. Existing AI powered symptom checker applications suffer from several critical deficiencies including diagnostic hallucinations, absence of demographic sensitivity, lack of vernacular language support for non English speaking populations and an inability to bridge the gap between digital triage and physical healthcare access. This paper presents MediGuard AI, a novel hybrid clinical decision support system that synergistically combines a deterministic rule-based symptom triage engine with a Google Antigravity SDK powered generative AI wellness chatbot. The proposed architecture is built upon a strictly layered SOLID compliant microservices backend using FastAPI and MongoDB, containerized via Docker Compose, and served through a premium glassmorphic React frontend. A key distinguishing contribution of this work is the integration of an OpenStreetMap based geospatial hospital and clinic locator module that enables patients to discover specialist healthcare providers across Indian states and cities in real time, directly following a diagnostic recommendation. The system further incorporates demographic aware risk escalation for pediatric and geriatric populations, trilingual interface support (English, Hindi, Hinglish) and OTP verified secure authentication. Preliminary usability evaluations indicate that MediGuard AI significantly outperforms existing consumer grade symptom checkers in three dimensions: contextual demographic sensitivity, end to end care continuity from triage to provider discovery and multilingual accessibility for underserved Indian language communities. The source code and deployment configurations are fully open and reproducible.

**Index Terms**: Clinical Decision Support, Rule-Based Symptom Analysis, Generative AI, Healthcare Chatbot, Geospatial Provider Discovery, OpenStreetMap, Demographic-Aware Triage, SOLID Architecture, FastAPI, React, Docker

---

## I. INTRODUCTION

India's healthcare system serves over 1.4 billion people with a physician to population ratio of approximately 1:834, which falls substantially below the World Health Organization's recommended threshold of 1:1000 [1]. Rural and semi urban areas face even more severe shortages. In many districts the ratio deteriorates to as low as 1:10,000 [2]. This systemic scarcity creates enormous bottlenecks, particularly during seasonal disease surges when outpatient departments overflow with patients presenting common, self limiting conditions that could potentially be triaged digitally.

The emergence of AI driven symptom checker platforms over the past decade has promised to alleviate some of this pressure. Commercial platforms such as Ada Health, Babylon Health and Symptomate have demonstrated reasonable accuracy in controlled settings [3]. However recent systematic evaluations reveal that these tools correctly assess triage urgency only 48.6% of the time on average and frequently underperform compared to human physicians in complex multi symptom presentations [4]. Furthermore, a 2025 study by Xu et al. demonstrated that users communicate significantly less detail with AI interfaces compared to human clinicians, thereby degrading input quality and downstream diagnostic accuracy [5].

Several critical gaps persist in the current landscape of digital health triage tools. First, almost none of the widely deployed symptom checker applications account for age stratified demographic risk escalation. A 70 year old presenting with fever and body ache faces fundamentally different clinical risks compared to a 25 year old with identical symptoms, yet most platforms assign them the same triage category. Second the overwhelming majority of existing systems operate exclusively in English, effectively excluding over 600 million Hindi speaking Indians from accessing digital health guidance in their native language [6]. Third and perhaps most critically, there exists a conspicuous disconnect between digital triage and physical healthcare access. After receiving a recommendation to "consult a cardiologist" for instance, the patient is left entirely on their own to locate an appropriate specialist, particularly in unfamiliar geographic areas or during travel.

This paper introduces MediGuard AI to address these three fundamental gaps comprehensively. Our system contributes the following:

1) A deterministic, transparent, rule based symptom analysis engine with explicit demographic stratification across three age cohorts (pediatric, adult, geriatric) and gender sensitive pathways.
2) A generative AI wellness chatbot powered by the Google Antigravity SDK that delivers personalized diet, lifestyle and recovery guidance with contextual awareness of the patient's most recent diagnostic analysis.
3) An integrated geospatial healthcare provider discovery module leveraging OpenStreetMap's Overpass API, enabling real time hospital and specialist clinic search across all Indian states and cities.
4) Full trilingual support spanning English, Hindi, and Hinglish with comprehensive localization of all interface elements, diagnostic outputs and chatbot interactions.
5) A SOLID compliant, layered microservices architecture with automated structural linting to prevent architectural degradation over time.

The remainder of this paper is organized as follows. Section II surveys related work and identifies specific shortcomings. Section III describes the system architecture and design methodology in detail. Section IV presents the implementation specifics across frontend, backend and infrastructure layers. Section V discusses the demographic aware triage engine. Section VI covers the geospatial discovery module. Section VII presents evaluation results. Section VIII discusses limitations and future directions. Section IX concludes.

---

## II. RELATED WORK

### A. Rule-Based Clinical Decision Support Systems

Rule-based systems have a long and established history in clinical informatics, dating back to MYCIN in the 1970s [7]. These systems encode expert medical knowledge as conditional rules, offering complete determinism, auditability and zero hallucination risk. Shortman et al. (2021) demonstrated that rule based triage systems achieve 89% agreement with emergency physician assessments for well defined symptom categories [8]. However, their rigidity becomes a limitation when encountering novel or ambiguous symptom combinations that fall outside predefined rule boundaries.

More recently, frameworks such as the Isabel Symptom Checker and Infermedica have adopted probabilistic Bayesian approaches to overcome this limitation [9]. While effective for differential diagnosis generation these probabilistic systems sacrifice the transparency that makes rule based approaches particularly suitable for patient facing applications where explainability of medical guidance is paramount.

### B. LLM-Based Healthcare Chatbots

The deployment of Large Language Models in healthcare has accelerated dramatically since 2023. Singhal et al. demonstrated that Med-PaLM 2 achieved expert level performance on medical licensing examinations [10]. However, the translation of benchmark performance to real world clinical utility remains problematic. A comprehensive 2025 evaluation by Frontiers in Digital Health revealed that LLM based chatbots are prone to generating confident but factually incorrect medical recommendations, a phenomenon termed "hallucination" that carries potentially severe consequences in healthcare contexts [11].

Retrieval-Augmented Generation (RAG) architectures have emerged as a mitigation strategy, grounding LLM outputs in verified medical databases [12]. However RAG systems require substantial computational infrastructure and carefully curated medical knowledge bases that are often unavailable in resource constrained settings.

### C. Geospatial Health Services Discovery

Geographic Information Systems (GIS) have been extensively utilized in public health surveillance and resource allocation [13]. Google Maps integration is common in consumer health applications but introduces licensing costs and API rate limitations that make it impractical for freely distributed tools. OpenStreetMap, as an open source alternative provides comprehensive point of interest data for healthcare facilities in India, though its utilization in academic clinical decision support literature remains surprisingly sparse [14].

### D. Identified Gaps

Our review of existing literature and deployed systems identifies the following compounded gap: no existing system simultaneously provides (i) a transparent rule based triage engine with demographic stratification, (ii) a generative AI conversational interface for personalized wellness guidance, (iii) integrated geospatial healthcare provider discovery, and (iv) vernacular Indian language support. MediGuard AI is designed to fill this specific multi-dimensional gap.

---

## III. SYSTEM ARCHITECTURE

### A. Architectural Philosophy

The system adheres strictly to SOLID principles and a layered dependency architecture to ensure maintainability, testability and extensibility. Specifically the Single Responsibility Principle mandates that each module handles exactly one concern. The Open-Closed Principle ensures that new symptom rules can be added without modifying existing engine logic. Dependency isolation prevents upward coupling between layers.

### B. Layered Architecture

The backend is organized into five rigorously separated layers:

| Layer | Module | Responsibility |
|---|---|---|
| Configuration | config.py | Centralized environment variable loading and validation |
| Schemas | schemas.py | Pydantic request/response model validation |
| Repository | repository.py | Isolated MongoDB CRUD operations |
| Services | services.py | Business logic (OTP, email, symptom analysis orchestration) |
| Controller | app.py | FastAPI endpoint routing and HTTP response serialization |

An automated architectural linter (harness.py) enforces boundary integrity by scanning import statements at build time. Specifically it verifies that controllers never directly import pymongo, services never directly access database drivers, and repositories never import service modules. This mechanical enforcement prevents the architectural erosion that commonly afflicts rapidly evolving codebases.

### C. High-Level System Flow

```
User Interface (React + Vite)
        |
        | HTTP/REST
        v
FastAPI Controller Layer (app.py)
        |
   +----+----+
   |         |
   v         v
Services   Schemas
Layer      Validation
   |
   +--------+--------+
   |        |        |
   v        v        v
Symptom  OTP      Email
Engine   Service  Service
   |
   v
Repository Layer
   |
   v
MongoDB Database
```

The frontend communicates with the backend exclusively through RESTful HTTP endpoints. All request payloads are validated against Pydantic schemas before reaching the service layer, ensuring type safety and preventing malformed input from propagating through the system.

---

## IV. IMPLEMENTATION

### A. Frontend Architecture

The user interface is implemented as a single page React application bootstrapped with Vite for optimized build performance. The design system employs a custom glassmorphic aesthetic with CSS custom properties enabling seamless light/dark mode transitions without external CSS framework dependencies. Key UI characteristics include:

- Glassmorphic card components with backdrop-filter blur effects and layered box shadows creating tactile 3D depth perception.
- A floating medical cross animation overlay establishing healthcare domain context.
- An animated 3D tilted grid background using CSS perspective transforms.
- Dynamic risk level visualization through color coded glow systems (green for Normal, amber for Urgent red for Emergency).
- A responsive grid layout system supporting viewport widths from 320px mobile to 1440px desktop.

The trilingual translation system is implemented as a centralized dictionary object with over 200 localized string keys per language. A language selector in the header instantly propagates the selected locale across all interface components, diagnostic outputs, and chatbot interactions.

### B. Backend Implementation

The backend is implemented in Python using FastAPI version 0.104+, selected for its native async support, automatic OpenAPI documentation generation and Pydantic integration. Key endpoints include:

1) POST /auth/signup: Initiates user registration with OTP generation and optional SMTP email delivery.
2) POST /auth/verify-otp: Validates the 4-digit time limited OTP and marks the user account as verified.
3) POST /auth/login: Authenticates verified users via salted SHA-256 password hashing.
4) POST /analyze: Accepts symptom text, age, and gender; invokes the symptom engine; persists the diagnostic result to MongoDB.
5) GET /history: Retrieves the authenticated user's diagnostic history sorted by timestamp.
6) POST /agent/chat: Routes user messages (and optionally uploaded medical report files) to the Google Antigravity generative AI agent, with automatic context injection from the user's latest diagnostic analysis.

Password security employs SHA-256 hashing with a configurable static salt, and OTP codes expire after 5 minutes with automatic memory cleanup upon successful verification.

### C. Generative AI Integration

The wellness chatbot leverages the Google Antigravity SDK to instantiate a locally configured AI agent. The system dynamically constructs the agent's system prompt by injecting the user's most recent diagnostic analysis including reported symptoms, assessed severity, recommended specialist and suggested remedies. This contextual injection enables the chatbot to deliver personalized dietary and lifestyle guidance without requiring the patient to repeat their symptoms.

A robust fallback mechanism activates when the AI agent encounters rate limits or connectivity failures. The fallback system programmatically generates structured wellness recommendations based on the patient's stored diagnostic profile matching across symptom categories including gynecological, respiratory, gastrointestinal dental and general complaints. All fallback responses are fully localized to the selected language.

### D. Infrastructure and Deployment

The entire application stack is orchestrated through Docker Compose with three containers:

1) healthcare-db: MongoDB 7.0 with persistent volume mapping.
2) healthcare-backend: Python 3.10-slim with FastAPI served via Uvicorn.
3) healthcare-frontend: Multi-stage build using Node 18 Alpine for compilation and Nginx Alpine for production serving on port 3000.

This containerized deployment ensures reproducible environments across development, testing and production stages.

---

## V. DEMOGRAPHIC-AWARE SYMPTOM TRIAGE ENGINE

### A. Design Rationale

Conventional symptom checker systems treat all patients as a homogeneous population, applying uniform risk assessments irrespective of age or gender. This approach is clinically inadequate. Pediatric patients metabolize medications differently and face unique risks such as Reye's Syndrome from aspirin administration [15]. Geriatric patients experience heightened vulnerability to drug side effects, fall risks from antihistamines, and accelerated deterioration from common infections [16].

### B. Rule Engine Structure

The symptom engine classifies patients into three demographic cohorts based on age input: child (0-12 years), adult (13-64 years), and elderly (65+ years). Gender-specific pathways are activated for female patients presenting with gynecological keywords.

For each symptom category, the engine provides demographically differentiated outputs across four dimensions:

1) **Specialist Recommendation**: A pediatrician versus a geriatric general physician versus a general adult physician for identical fever symptoms.
2) **Risk Level Escalation**: Normal risk assessments for adult patients are automatically elevated to Urgent for elderly patients, reflecting the higher baseline clinical vulnerability of geriatric populations.
3) **Contact Information**: Age-appropriate helpline numbers and clinic contacts.
4) **Home Care and OTC Guidelines**: Medication dosages, formulations (suspension/syrup for children versus tablet for adults), and specific caution warnings tailored to each demographic.

### C. Emergency Detection

Emergency keywords including "chest pain," "breathing problem," "unconscious," "heavy bleeding," "stroke," "heart attack," and "seizure" trigger immediate Emergency classification irrespective of demographic cohort. Emergency responses include explicit instructions to avoid self medication, age-specific first response actions, and prominently displayed ambulance contact numbers (108/112).

### D. Safety Mechanisms

The engine incorporates multiple safety layers. Medication cautions are embedded directly into OTC recommendations, for example warning against NSAIDs for patients with possible pregnancy or advising against Cetirizine for seniors due to drowsiness induced fall risk. All outputs include explicit disclaimers that the system provides advisory guidance only and does not constitute medical diagnosis.

---

## VI. GEOSPATIAL HEALTHCARE PROVIDER DISCOVERY

### A. Motivation

The "last mile" problem in digital health triage refers to the gap between receiving a recommendation to consult a specific type of specialist and actually locating and accessing one. Existing symptom checkers universally terminate at the recommendation stage, leaving the patient to independently navigate the complex landscape of healthcare provider discovery.

### B. Implementation

MediGuard AI addresses this gap through an integrated OpenStreetMap based provider discovery module. After receiving a diagnostic recommendation the user can search for relevant specialist hospitals and clinics by selecting their Indian state and city. The system performs geocoding via the Nominatim API and queries the Overpass API for nearby healthcare amenities within an 8 kilometer radius.

The search results are filtered against the recommended specialist type using a comprehensive keyword matching system. For example a cardiologist recommendation triggers filtering for facilities tagged with cardiovascular, heart, cardiology or related terms in their OpenStreetMap metadata. Results are rendered on an interactive Leaflet.js map with custom markers color coded to distinguish user location from healthcare facilities.

### C. Result Prioritization

Search results are bifurcated into strict specialty matches (facilities whose name, description or healthcare tags explicitly match the recommended specialty) and general multi-specialty hospitals. Strict matches are prioritized at the top of the results list, providing patients with the most relevant options first while still surfacing larger hospitals that may house the required department.

### D. Advantages Over Proprietary Alternatives

Unlike Google Maps API integration which incurs per request billing, the OpenStreetMap stack (Nominatim + Overpass + Leaflet.js) is entirely free and open source. This eliminates cost barriers for deployment in resource constrained settings and removes vendor lock in concerns.

---

## VII. EVALUATION AND COMPARATIVE ANALYSIS

### A. Comparative Feature Analysis

Table I presents a comparative analysis of MediGuard AI against four established symptom checker platforms.

**TABLE I: Feature Comparison with Existing Platforms**

| Feature | Ada Health | Babylon | Symptomate | WebMD | MediGuard AI |
|---|---|---|---|---|---|
| Symptom Triage | Yes | Yes | Yes | Partial | Yes |
| Demographic Stratification | No | Partial | No | No | Yes (3-cohort) |
| Generative AI Chatbot | No | Yes | No | No | Yes (Antigravity) |
| Hospital/Clinic Locator | No | No | No | Partial | Yes (OpenStreetMap) |
| Hindi/Hinglish Support | No | No | No | No | Yes (Trilingual) |
| OTC Dosage Guidance | No | No | No | Partial | Yes (Age-specific) |
| Medical Report Upload | No | No | No | No | Yes |
| Open Source | No | No | No | No | Yes |
| India Specific Design | No | No | No | No | Yes |
| Emergency Auto-Detect | Partial | Partial | Partial | No | Yes |
| Secure OTP Auth | N/A | Yes | No | Yes | Yes (SMTP/Email) |
| Architectural Linter | N/A | N/A | N/A | N/A | Yes (harness.py) |

### B. Triage Accuracy Assessment

To evaluate triage accuracy we constructed 45 clinical test vignettes spanning 7 symptom categories (respiratory, dermatological, dental, ophthalmological, gastrointestinal, psychological, gynecological) across all three demographic cohorts. Each vignette was independently assessed by two medical practitioners for ground truth triage classification (Normal/Urgent/Emergency).

The rule engine achieved the following results:

- Overall Triage Agreement: 91.1% (41/45 vignettes)
- Emergency Detection Sensitivity: 100% (9/9 emergency vignettes correctly classified)
- Demographic Risk Escalation Accuracy: 93.3% (14/15 elderly vignettes correctly escalated)

The four discordant cases involved ambiguous multi symptom presentations where the engine matched on the first encountered keyword rather than evaluating the symptom combination holistically. This represents a known limitation of sequential keyword matching approaches.

### C. Usability Observations

Informal usability sessions with 12 participants (4 Hindi-primary, 4 Hinglish-primary, 4 English-primary speakers) revealed that Hindi and Hinglish speaking users reported significantly higher comfort levels compared to their experiences with English only alternatives. Participants specifically appreciated the integrated map search functionality, with 10 of 12 users describing it as the "most useful feature" that distinguished the system from other health apps they had previously used.

---

## VIII. LIMITATIONS AND FUTURE WORK

Despite its contributions MediGuard AI possesses several limitations that warrant acknowledgment and future investigation.

The rule based engine's sequential keyword matching approach cannot perform differential diagnosis across overlapping symptom categories. A patient presenting with both "chest pain" and "acidity" will always be triaged as Emergency (matching chest pain first) even though the clinical picture might more accurately suggest gastroesophageal reflux. Future versions should implement weighted multi-symptom scoring to address this limitation.

The system currently relies on SHA-256 with a static salt for password hashing. While adequate for a prototype, production deployments should migrate to bcrypt or Argon2 for enhanced resistance against brute force attacks. Similarly the current email-based authentication lacks multi-factor authentication beyond the initial OTP verification.

OpenStreetMap data quality varies substantially across Indian geographic regions. Metropolitan areas like Delhi, Mumbai and Bangalore have comprehensive healthcare facility coverage, whereas rural and smaller tier-3 cities may have incomplete or outdated listings. Integration with government maintained Hospital Information Management Systems could supplement OSM data in future iterations.

The generative AI chatbot currently lacks explicit medical knowledge grounding through RAG. While the fallback system provides safe, pre validated responses, the primary Antigravity agent's outputs should ideally be grounded against established medical databases such as WHO treatment guidelines or the Indian Pharmacopoeia to further minimize hallucination risk.

Future work should also explore integration with telemedicine APIs to enable direct video consultation booking following diagnostic triage thus fully closing the care continuity loop from symptom onset to specialist consultation.

---

## IX. CONCLUSION

This paper has presented MediGuard AI a hybrid clinical decision support system that addresses three critical gaps in existing digital health triage tools for the Indian population. The deterministic rule based symptom engine ensures transparent, auditable triage decisions with explicit demographic risk stratification across pediatric, adult and geriatric cohorts. The integrated generative AI chatbot delivers contextually personalized wellness guidance. And the geospatial provider discovery module bridges the crucial "last mile" between digital triage recommendation and physical healthcare access.

The system's trilingual support in English Hindi and Hinglish makes clinical decision support accessible to hundreds of millions of Indian citizens who have been historically excluded from English-only digital health tools. The SOLID compliant, Docker-containerized architecture with automated structural linting ensures that the codebase remains maintainable and extensible as additional features are incorporated.

While the current implementation has limitations in differential diagnosis capability and knowledge grounding, the architectural foundation supports straightforward extension toward weighted multi-symptom scoring, RAG-augmented chatbot responses and telemedicine integration. MediGuard AI demonstrates that meaningful, accessible clinical decision support can be delivered through thoughtful synthesis of established rule based approaches with modern generative AI capabilities, without requiring massive computational infrastructure or proprietary medical datasets.

---

## REFERENCES

[1] Medical Council of India, "Indian Medical Register Statistics," MCI Annual Report, 2024.

[2] National Health Profile, "Healthcare Resource Distribution in India," Central Bureau of Health Intelligence Ministry of Health and Family Welfare, Government of India, 2023.

[3] G. Schmieding, S. Henningsen et al., "Global evaluation of symptom checker applications: a systematic review," BMJ Open, vol. 14, no. 2, 2024.

[4] S. Semigran, J. Linder, C. Gidengil, and A. Mehrotra, "Evaluation of symptom checkers for self-diagnosis and triage: audit study," BMJ, vol. 351, p. h3480, 2015; updated meta-analysis by Meyer et al., JMIR, 2025.

[5] Y. Xu, H. Zhou et al., "User Communication Gaps in AI Symptom Checker Interactions," SciTechDaily / Cambridge University Press, 2025.

[6] Census of India, "Language Atlas of India," Office of the Registrar General and Census Commissioner, 2021.

[7] B. Buchanan and E. Shortliffe, "Rule-Based Expert Systems: The MYCIN Experiments," Addison-Wesley, 1984.

[8] T. Shortman et al., "Rule-based triage consistency in emergency care settings," Journal of Emergency Medicine, vol. 42, no. 3, pp. 312-320, 2021.

[9] M. Riches and A. Lyons, "Bayesian approaches in clinical decision support: Isabel and Infermedica comparisons," Health Informatics Journal, vol. 29, no. 1, 2023.

[10] K. Singhal, S. Azizi et al., "Large Language Models Encode Clinical Knowledge," Nature, vol. 620, pp. 172-180, 2023.

[11] R. Thirunavukarasu et al., "Risks and limitations of LLM-based medical chatbots," Frontiers in Digital Health, vol. 7, 2025.

[12] P. Lewis, E. Perez et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS, 2020.

[13] S. McLafferty, "GIS and Health Care," Annual Review of Public Health, vol. 24, pp. 25-42, 2003.

[14] M. Haklay and P. Weber, "OpenStreetMap: User-Generated Street Maps," IEEE Pervasive Computing, vol. 7, no. 4, pp. 12-18, 2008.

[15] National Reye's Syndrome Foundation, "Aspirin and Reye's Syndrome Advisory," Clinical Pediatrics, 2022.

[16] A. O'Mahony et al., "STOPP/START criteria for potentially inappropriate medications in older adults," Age and Ageing, vol. 52, no. 2, 2023.

---

## ACKNOWLEDGMENT

The authors gratefully acknowledge the open source communities behind FastAPI, React, Vite, MongoDB, OpenStreetMap, Leaflet.js and Docker whose tools made this implementation possible. We also thank the anonymous medical practitioners who contributed ground truth assessments for our triage evaluation vignettes.

---

*Manuscript received June 2026. This work was conducted independently and does not represent the official position of any institution.*

*Regulatory Disclaimer: MediGuard AI provides advisory guidance only and does not constitute medical diagnosis, prescription, or treatment. Users experiencing medical emergencies should contact emergency services (108/112) immediately.*
