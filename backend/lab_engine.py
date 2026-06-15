from typing import Dict, Any

def analyze_lab_values(metrics: Dict[str, float], gender: str = "male") -> Dict[str, Any]:
    gender = gender.lower()
    
    results = {}
    recommendations = []
    
    # 1. Hemoglobin
    hb = metrics.get("hemoglobin")
    if hb is not None:
        if gender == "female":
            normal_min, normal_max = 12.1, 15.1
        else: # male or other default
            normal_min, normal_max = 13.8, 17.2
            
        if hb < normal_min:
            results["hemoglobin"] = {"status": "Low", "range": f"{normal_min}-{normal_max} g/dL"}
            recommendations.append("Hemoglobin is low (potential anemia). Include iron-rich foods (spinach, beetroot, lentils, red meat) and Vitamin C to aid absorption.")
        elif hb > normal_max:
            results["hemoglobin"] = {"status": "High", "range": f"{normal_min}-{normal_max} g/dL"}
            recommendations.append("Hemoglobin is high. Ensure proper hydration and consult a physician to rule out polycythemia.")
        else:
            results["hemoglobin"] = {"status": "Normal", "range": f"{normal_min}-{normal_max} g/dL"}

    # 2. WBC
    wbc = metrics.get("wbc")
    if wbc is not None:
        if wbc < 4000:
            results["wbc"] = {"status": "Low", "range": "4000-11000 cells/mcL"}
            recommendations.append("WBC count is low (leukopenia). Take precautions to avoid infections: wash hands regularly and avoid crowds.")
        elif wbc > 11000:
            results["wbc"] = {"status": "High", "range": "4000-11000 cells/mcL"}
            recommendations.append("WBC count is high (leukocytosis). This often indicates an active infection, inflammation, or physical stress.")
        else:
            results["wbc"] = {"status": "Normal", "range": "4000-11000 cells/mcL"}

    # 3. Platelets
    plt = metrics.get("platelets")
    if plt is not None:
        if plt < 150000:
            results["platelets"] = {"status": "Low", "range": "150000-450000 cells/mcL"}
            recommendations.append("Platelet count is low (thrombocytopenia). Avoid injury-prone physical tasks and consult a doctor if you experience unexplained bruising.")
        elif plt > 450000:
            results["platelets"] = {"status": "High", "range": "150000-450000 cells/mcL"}
            recommendations.append("Platelet count is high (thrombocytosis). Consult a doctor to check for clotting risks or secondary inflammation.")
        else:
            results["platelets"] = {"status": "Normal", "range": "150000-450000 cells/mcL"}

    # 4. Sugar (Fasting Blood Glucose)
    sugar = metrics.get("sugar")
    if sugar is not None:
        if sugar < 70:
            results["sugar"] = {"status": "Low", "range": "70-100 mg/dL"}
            recommendations.append("Blood sugar is low (hypoglycemia). Consume fast-acting glucose or sweet fruit juices immediately to raise levels.")
        elif 70 <= sugar <= 100:
            results["sugar"] = {"status": "Normal", "range": "70-100 mg/dL"}
        elif 101 <= sugar <= 125:
            results["sugar"] = {"status": "Borderline High (Prediabetes)", "range": "70-100 mg/dL"}
            recommendations.append("Fasting sugar is borderline high (prediabetes). Limit simple carbohydrates, exercise regularly, and focus on fiber-rich diets.")
        else: # sugar >= 126
            results["sugar"] = {"status": "High (Diabetes)", "range": "70-100 mg/dL"}
            recommendations.append("Fasting sugar is high (indicative of diabetes). Please visit an endocrinologist or general physician for proper diagnostic screening.")

    # 5. Vitamin D
    vit_d = metrics.get("vitamin_d")
    if vit_d is not None:
        if vit_d < 20:
            results["vitamin_d"] = {"status": "Deficient", "range": "30-100 ng/mL"}
            recommendations.append("Vitamin D is deficient. Consider sunlight exposure (10-15 mins daily) and consult a physician about Vitamin D3 supplementation.")
        elif 20 <= vit_d < 30:
            results["vitamin_d"] = {"status": "Insufficient", "range": "30-100 ng/mL"}
            recommendations.append("Vitamin D is insufficient. Add fortified foods, eggs, mushrooms, and dairy to your diet.")
        elif 30 <= vit_d <= 100:
            results["vitamin_d"] = {"status": "Normal", "range": "30-100 ng/mL"}
        else: # > 100
            results["vitamin_d"] = {"status": "High/Toxicity Risk", "range": "30-100 ng/mL"}
            recommendations.append("Vitamin D is excessively high. Consult a doctor regarding reduction of any ongoing supplementation.")

    # 6. Cholesterol
    chol = metrics.get("cholesterol")
    if chol is not None:
        if chol < 200:
            results["cholesterol"] = {"status": "Normal", "range": "<200 mg/dL"}
        elif 200 <= chol <= 239:
            results["cholesterol"] = {"status": "Borderline High", "range": "<200 mg/dL"}
            recommendations.append("Cholesterol is borderline high. Reduce intake of saturated fats and trans-fats; incorporate omega-3 fatty acids (flaxseeds, fish).")
        else: # >= 240
            results["cholesterol"] = {"status": "High", "range": "<200 mg/dL"}
            recommendations.append("Cholesterol is high. Implement structured cardiovascular exercises and consult a doctor regarding lipid profile management.")

    # 7. Creatinine (Kidney Function)
    crt = metrics.get("creatinine")
    if crt is not None:
        if gender == "female":
            normal_min, normal_max = 0.5, 1.1
        else: # male/other
            normal_min, normal_max = 0.6, 1.2
            
        if crt < normal_min:
            results["creatinine"] = {"status": "Low", "range": f"{normal_min}-{normal_max} mg/dL"}
            recommendations.append("Creatinine is low, which can indicate lower muscle mass or dilution. Ensure proper protein intake.")
        elif crt > normal_max:
            results["creatinine"] = {"status": "High", "range": f"{normal_min}-{normal_max} mg/dL"}
            recommendations.append("Creatinine is high (potential indicator of kidney stress). Avoid heavy NSAID usage, drink adequate fluids, and seek a doctor's evaluation.")
        else:
            results["creatinine"] = {"status": "Normal", "range": f"{normal_min}-{normal_max} mg/dL"}

    # Overall Verdict
    out_of_range_count = sum(1 for k, v in results.items() if v["status"] != "Normal")
    if out_of_range_count == 0:
        verdict = "All evaluated metrics are within standard reference ranges. Continue maintaining a balanced lifestyle!"
    else:
        verdict = f"{out_of_range_count} metrics are outside reference limits. Please follow the recommendations and consult a physician."
        
    return {
        "results": results,
        "verdict": verdict,
        "recommendations": recommendations
    }
