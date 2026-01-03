import shutil
import os
import time

lock_path = r"D:\dev-env\playwright_browsers_new\__dirlock"

if os.path.exists(lock_path):
    print(f"Removing lock file/dir: {lock_path}")
    try:
        if os.path.isdir(lock_path):
            shutil.rmtree(lock_path)
        else:
            os.remove(lock_path)
        print("Lock removed successfully.")
    except Exception as e:
        print(f"Error removing lock: {e}")
else:
    print("No lock file found.")
