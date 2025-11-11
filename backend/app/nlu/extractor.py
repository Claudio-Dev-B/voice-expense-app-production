import re
import unicodedata

def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("utf-8")
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("reai", "reais").replace("reaus", "reais").replace("reals", "reais")
    return text

def extract_amount(text: str) -> float:
    text = normalize_text(text)

    numeric_pattern = re.compile(
        r"(?i)(?:r\$ ?)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais?|r?s)?"
    )
    matches = numeric_pattern.findall(text)

    if matches:
        values = []
        for match in matches:
            clean = match.replace(".", "").replace(",", ".")
            try:
                values.append(float(clean))
            except ValueError:
                pass
        if values:
            return max(values)

    # converter por extenso (versão simplificada e robusta)
    number_words = {
        "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "três": 3,
        "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9,
        "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14,
        "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19,
        "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60,
        "setenta": 70, "oitenta": 80, "noventa": 90,
        "cem": 100, "cento": 100, "duzentos": 200, "trezentos": 300,
        "quatrocentos": 400, "quinhentos": 500, "seiscentos": 600,
        "setecentos": 700, "oitocentos": 800, "novecentos": 900,
        "mil": 1000
    }

    words = text.split()
    total = 0
    temp = 0

    for w in words:
        if w in number_words:
            val = number_words[w]
            if val == 1000:
                if temp == 0:
                    temp = 1
                total += temp * 1000
                temp = 0
            else:
                temp += val
        elif w == "e":
            continue
        elif "reais" in w or "real" in w:
            total += temp
            temp = 0

    total += temp
    return float(total)
