import sqlite3
conn = sqlite3.connect(r"D:\data\finestem\finestem.db")
conn.execute("DELETE FROM achievement_cards WHERE project_id = 'f2a11545-2b53-488d-8c38-7048f3adc801'")
conn.commit()
print("Deleted")
conn.close()
