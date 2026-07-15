#!/usr/bin/env python3
"""Slow-and-steady 2026 WC squads collector: sequential Wikipedia fetches (~1 req/s),
no LLM, resumable via done-codes checkpoint. Parses the '2026 FIFA World Cup squads'
wikitext section per team."""
import json, re, time, urllib.request, urllib.parse, sys, os

ROOT = "/Users/kengorgor/BigAppleRoot/AI3_Hackathon/wc2030-scout/data"
SQUADS = f"{ROOT}/squads.json"
CKPT = f"{ROOT}/.squads48.done.json"
UA = {"User-Agent": "WC2030Scout/1.0 (hackathon; contact: demo)"}
PAGE = "2026 FIFA World Cup squads"

LEAGUE_BY_COUNTRY = {
    "England": "Premier League", "Spain": "La Liga", "Italy": "Serie A",
    "Germany": "Bundesliga", "France": "Ligue 1", "United States": "MLS",
    "Mexico": "Liga MX", "Saudi Arabia": "Saudi Pro League", "Japan": "J1 League",
    "South Korea": "K League 1", "Netherlands": "Eredivisie", "Portugal": "Primeira Liga",
    "Turkey": "Süper Lig", "Brazil": "Brasileirão", "Argentina": "Argentine Primera",
    "Scotland": "Scottish Premiership", "Belgium": "Belgian Pro League",
    "Greece": "Super League Greece", "Qatar": "Qatar Stars League",
    "Egypt": "Egyptian Premier League", "Morocco": "Botola",
    "Australia": "A-League", "Denmark": "Danish Superliga", "Austria": "Austrian Bundesliga",
    "Switzerland": "Swiss Super League", "Croatia": "HNL", "Poland": "Ekstraklasa",
    "Norway": "Eliteserien", "Sweden": "Allsvenskan", "Russia": "Russian Premier League",
    "China": "Chinese Super League", "United Arab Emirates": "UAE Pro League",
    "Colombia": "Categoría Primera A", "Ecuador": "LigaPro", "Uruguay": "Uruguayan Primera",
    "Canada": "MLS", "Iran": "Persian Gulf Pro League", "Uzbekistan": "Uzbekistan Super League",
    "Jordan": "Jordanian Pro League", "Tunisia": "Tunisian Ligue 1",
    "Algeria": "Algerian Ligue 1", "South Africa": "PSL", "Ghana": "Ghana Premier League",
    "Ivory Coast": "Ligue 1 (CIV)", "Senegal": "Senegal Ligue 1",
    "New Zealand": "A-League", "Paraguay": "Paraguayan Primera", "Panama": "LPF",
    "Costa Rica": "Liga FPD", "Honduras": "Liga Nacional", "Curaçao": "Other",
    "Haiti": "Other", "Cape Verde": "Other",
}

LEAGUE_BY_CODE = {
    "ENG": "Premier League", "ESP": "La Liga", "ITA": "Serie A", "GER": "Bundesliga",
    "FRA": "Ligue 1", "USA": "MLS", "MEX": "Liga MX", "KSA": "Saudi Pro League",
    "JPN": "J1 League", "KOR": "K League 1", "NED": "Eredivisie", "POR": "Primeira Liga",
    "TUR": "Süper Lig", "BRA": "Brasileirão", "ARG": "Argentine Primera",
    "SCO": "Scottish Premiership", "BEL": "Belgian Pro League", "GRE": "Super League Greece",
    "QAT": "Qatar Stars League", "EGY": "Egyptian Premier League", "MAR": "Botola",
    "AUS": "A-League", "DEN": "Danish Superliga", "AUT": "Austrian Bundesliga",
    "SUI": "Swiss Super League", "CRO": "HNL", "POL": "Ekstraklasa", "NOR": "Eliteserien",
    "SWE": "Allsvenskan", "RUS": "Russian Premier League", "CHN": "Chinese Super League",
    "UAE": "UAE Pro League", "COL": "Categoría Primera A", "ECU": "LigaPro",
    "URU": "Uruguayan Primera", "CAN": "MLS", "IRN": "Persian Gulf Pro League",
    "UZB": "Uzbekistan Super League", "JOR": "Jordanian Pro League", "TUN": "Tunisian Ligue 1",
    "ALG": "Algerian Ligue 1", "RSA": "PSL", "GHA": "Ghana Premier League",
    "CIV": "Ligue 1 (CIV)", "SEN": "Senegal Ligue 1", "NZL": "A-League",
    "PAR": "Paraguayan Primera", "PAN": "LPF", "CRC": "Liga FPD", "HON": "Liga Nacional",
    "WAL": "Premier League", "IRL": "Premier League", "CZE": "Czech First League",
    "SVK": "Slovak Super Liga", "SRB": "Serbian SuperLiga", "UKR": "Ukrainian Premier League",
    "HUN": "NB I", "ROU": "Liga I", "CYP": "Cypriot First Division", "ISR": "Israeli Premier League",
    "IDN": "Liga 1 (IDN)", "IRQ": "Iraq Stars League", "PER": "Liga 1 (PER)",
}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=30).read().decode()

def get_sections():
    u = f"https://en.wikipedia.org/w/api.php?action=parse&page={urllib.parse.quote(PAGE)}&prop=sections&format=json"
    d = json.loads(fetch(u))
    return d["parse"]["sections"]

def get_section_wikitext(idx):
    u = f"https://en.wikipedia.org/w/api.php?action=parse&page={urllib.parse.quote(PAGE)}&prop=wikitext&section={idx}&format=json"
    d = json.loads(fetch(u))
    return d["parse"]["wikitext"]["*"]

POS_MAP = {"GK": "GK", "DF": "DF", "MF": "MF", "FW": "FW"}

def clean_link(s):
    # [[A|B]] -> B ; [[A]] -> A ; strip templates/tags
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()

def parse_players(wikitext):
    players = []
    # one player per line: {{nat fs g player|no=1|pos=GK|name=...|age=...|caps=..|goals=..|club=..|clubnat=..}}
    for line in wikitext.splitlines():
        if "fs g player" not in line and "fs player" not in line:
            continue
        fields = {}
        for part in re.split(r"\|(?=[a-z]+=)", line):
            if "=" in part:
                k, v = part.split("=", 1)
                fields[k.strip()] = v.strip().rstrip("}").strip()
        raw_name = fields.get("name", "")
        name = clean_link(raw_name)
        if not name:
            continue
        is_captain = "captain" in line.lower()
        name = re.sub(r"\s*\((?:captain|c)\)\s*$", "", name, flags=re.I)
        if is_captain:
            name += " (captain)"
        pos = POS_MAP.get(clean_link(fields.get("pos", "")).upper())
        # age templates put the reference date first ({{birth date and age2|df=y|2026|6|11|1994|6|24}}).
        # Field-splitting breaks on inner |df=y, so extract years from the raw age template in the line:
        am = re.search(r"age=\{\{[^}]*\}\}", line)
        years = [int(y) for y in re.findall(r"(19[5-9]\d|20[0-1]\d)", am.group(0) if am else fields.get("age", ""))]
        by = min(years) if years else None
        club = clean_link(fields.get("club", ""))
        clubnat = clean_link(fields.get("clubnat", ""))
        caps = int(re.sub(r"\D", "", fields.get("caps", "0")) or 0)
        goals = int(re.sub(r"\D", "", fields.get("goals", "0")) or 0)
        league = LEAGUE_BY_COUNTRY.get(clubnat) or LEAGUE_BY_CODE.get(clubnat.upper(), "Other")
        if pos and by:
            players.append({"name": name, "position": pos, "birthYear": by,
                            "club": club, "league": league, "caps": caps, "goals": goals})
    return players

FIFA_CODES = {
    "United States": "USA", "Mexico": "MEX", "Canada": "CAN", "Argentina": "ARG",
    "France": "FRA", "England": "ENG", "Brazil": "BRA", "Spain": "ESP", "Germany": "GER",
    "Japan": "JPN", "Morocco": "MAR", "Portugal": "POR", "Netherlands": "NED",
    "Belgium": "BEL", "Croatia": "CRO", "Italy": "ITA", "Switzerland": "SUI",
    "Denmark": "DEN", "Austria": "AUT", "Norway": "NOR", "Scotland": "SCO",
    "Poland": "POL", "Ukraine": "UKR", "Turkey": "TUR", "Sweden": "SWE",
    "Serbia": "SRB", "Wales": "WAL", "Czech Republic": "CZE", "Hungary": "HUN",
    "Romania": "ROU", "Greece": "GRE", "Slovakia": "SVK", "Slovenia": "SVN",
    "Albania": "ALB", "North Macedonia": "MKD", "Georgia": "GEO",
    "Senegal": "SEN", "Ivory Coast": "CIV", "Nigeria": "NGA", "Cameroon": "CMR",
    "Egypt": "EGY", "Algeria": "ALG", "Tunisia": "TUN", "Ghana": "GHA",
    "South Africa": "RSA", "Cape Verde": "CPV", "Mali": "MLI", "Burkina Faso": "BFA",
    "DR Congo": "COD", "Iran": "IRN", "Saudi Arabia": "KSA", "Qatar": "QAT",
    "Iraq": "IRQ", "Jordan": "JOR", "United Arab Emirates": "UAE", "Uzbekistan": "UZB",
    "South Korea": "KOR", "Australia": "AUS", "Indonesia": "IDN", "China": "CHN",
    "New Zealand": "NZL", "Ecuador": "ECU", "Uruguay": "URU", "Colombia": "COL",
    "Paraguay": "PAR", "Peru": "PER", "Chile": "CHI", "Venezuela": "VEN",
    "Bolivia": "BOL", "Panama": "PAN", "Costa Rica": "CRC", "Honduras": "HON",
    "Jamaica": "JAM", "Curaçao": "CUW", "Haiti": "HAI", "Guatemala": "GUA",
    "Bosnia and Herzegovina": "BIH",
}

def main():
    squads = json.load(open(SQUADS))
    have = {t["code"] for t in squads["teams"]}
    done = json.load(open(CKPT)) if os.path.exists(CKPT) else []
    secs = get_sections()
    time.sleep(1.2)
    team_secs = [(s["line"], s["index"]) for s in secs
                 if s["toclevel"] == 2 and s["line"] in FIFA_CODES]
    print(f"found {len(team_secs)} team sections; have {len(have)} teams already")
    for country, idx in team_secs:
        code = FIFA_CODES[country]
        if code in have or code in done:
            continue
        try:
            wt = get_section_wikitext(idx)
            players = parse_players(wt)
        except Exception as e:
            print(f"  ! {country}: {e} — will retry next run")
            time.sleep(3)
            continue
        if len(players) < 20:
            print(f"  ! {country}: only {len(players)} parsed — skipping (check parser)")
            time.sleep(1.2)
            continue
        squads["teams"].append({"country": country, "code": code, "players": players})
        done.append(code)
        json.dump(squads, open(SQUADS, "w"), ensure_ascii=False, indent=1)
        json.dump(done, open(CKPT, "w"))
        print(f"  + {country} ({code}): {len(players)} players  [total teams: {len(squads['teams'])}]")
        time.sleep(1.2)  # ~1 req/s — slow and steady
    print(f"DONE: {len(squads['teams'])} teams total")

if __name__ == "__main__":
    main()
