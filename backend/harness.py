import re
import sys
import os

def check_harness():
    print("--- Running Mechanical Architecture Harness Check ---")
    violations = []

    # Rules Definition
    # 1. app.py should not import pymongo or MongoClient directly
    app_path = "backend/app.py"
    if os.path.exists(app_path):
        with open(app_path, "r") as f:
            content = f.read()
            if "pymongo" in content or "MongoClient" in content:
                violations.append("Violation in backend/app.py: Direct import/use of pymongo/MongoClient detected. Use repository.py layer instead.")
            if re.search(r"os\.getenv\(", content) and "AUTH_SALT" in content:
                violations.append("Violation in backend/app.py: os.getenv should not be used directly in app.py for app configurations. Use config.py instead.")

    # 2. services.py should not import pymongo or MongoClient directly
    services_path = "backend/services.py"
    if os.path.exists(services_path):
        with open(services_path, "r") as f:
            content = f.read()
            if "pymongo" in content or "MongoClient" in content:
                violations.append("Violation in backend/services.py: Direct import/use of pymongo/MongoClient detected. Use repository.py layer instead.")

    # 3. repository.py should not import services.py (strict downward dependency)
    repository_path = "backend/repository.py"
    if os.path.exists(repository_path):
        with open(repository_path, "r") as f:
            content = f.read()
            if "services" in content:
                violations.append("Violation in backend/repository.py: Downward dependency violation. Repository layer must not import services.py.")

    if violations:
        print("\n[!] ARCHITECTURAL VIOLATIONS FOUND:")
        for v in violations:
            print(f"  - {v}")
        print("\nVerification failed. Please refactor code to adhere to strict SOLID layering.")
        sys.exit(1)
    else:
        print("\n[+] SUCCESS: Mechanical Architecture checks passed successfully.")
        sys.exit(0)

if __name__ == "__main__":
    check_harness()
