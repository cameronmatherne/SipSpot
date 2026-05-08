import re
import json
import uuid

INPUT_FILE = "lafayette_places.txt"
OUTPUT_FILE = "seed_spots.sql"

def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def parse_file():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        lines = [l.rstrip() for l in f.readlines()]

    spots = []
    current = None
    mode = None  # "daily" or "happy"

    for line in lines:
        line = line.strip()

        if not line:
            continue

        # New restaurant (no indent, no colon)
        if not line.startswith("\t") and not ":" in line:
            if current:
                spots.append(current)

            current = {
                "name": line,
                "daily_deals": [],
                "happy_hours": []
            }
            mode = None
            continue

        # Section headers
        if "daily" in line.lower():
            mode = "daily"
            continue

        if "happy" in line.lower():
            mode = "happy"
            continue

        # Content lines
        if current and mode:
            clean = line.strip("- ").strip()

            if mode == "daily":
                if ":" in clean:
                    day, desc = clean.split(":", 1)
                    current["daily_deals"].append({
                        "day": day.strip(),
                        "description": desc.strip()
                    })
                else:
                    current["daily_deals"].append({
                        "day": "unknown",
                        "description": clean
                    })

            elif mode == "happy":
                # try to split time vs description
                match = re.match(r'(.*?\d.*?m)\s+(.*)', clean)
                if match:
                    time, desc = match.groups()
                    current["happy_hours"].append({
                        "days": "unspecified",
                        "time": time.strip(),
                        "description": desc.strip()
                    })
                else:
                    current["happy_hours"].append({
                        "days": "unspecified",
                        "time": "",
                        "description": clean
                    })

    if current:
        spots.append(current)

    return spots


def generate_sql(spots):
    values = []

    for s in spots:
        spot_id = slugify(s["name"])

        daily = json.dumps(s["daily_deals"])
        happy = json.dumps(s["happy_hours"])

        values.append(f"""(
  '{spot_id}',
  '{s["name"].replace("'", "''")}',
  30.2241, -92.0198,
  null,
  '{daily}'::jsonb,
  '{happy}'::jsonb
)""")

    sql = f"""
begin;

insert into public.spots (
  id,
  name,
  latitude,
  longitude,
  cuisine,
  daily_deals,
  happy_hours
)
values
{",\n".join(values)};

commit;
"""

    return sql


if __name__ == "__main__":
    spots = parse_file()
    sql = generate_sql(spots)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"✅ Generated {len(spots)} spots into {OUTPUT_FILE}")