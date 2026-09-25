# Kitchen Math Rules

## One-empty-seat law
KNOWN + KNOWN + ... + ONE UNKNOWN → exact declared relationship → solve UNKNOWN → return seat → same Step resumes.

Two or more unresolved independent variables → UNDERDETERMINED → input-required / unresolved.

## Belt / continuous process
Residence time:
`t = L / v`

Belt speed:
`v = L / t`

Process length:
`L = v * t`

## Throughput
If loaded mass per unit belt length is known:
`m_dot = lambda_m * v`

Thus:
`v = m_dot / lambda_m`
`lambda_m = m_dot / v`

## Recipe scaling
`r = Y_desired / Y_base`
`I_i' = I_i * r`

This is a first-pass ingredient transform only. It does not prove that cooking time, pan geometry, proofing, evaporation, browning, or thermal behavior scale linearly.

## Pan geometry
Rectangular area: `A = l * w`
Circular area: `A = pi * r^2`
Area ratio: `r_A = A_new / A_old`
Approximate fill depth when volume is known: `d = V / A`

Changed fill depth should trigger downstream review.

## Heating energy (engineering estimate)
`Q = m * c_p * DeltaT`

This is an engineering relationship, not food-safety validation by itself.

## Determinism
`F(X,S,R)=Y`

X=input/Shape, S=complete relevant state, R=applicable rule/reference set, Y=result.

## Safety distinction
MATHEMATICALLY SOLVABLE ≠ PHYSICALLY VERIFIED

CALCULATE → RUN/MEASURE → VERIFY AGAINST AUTHORITATIVE TARGET → RECEIPT
