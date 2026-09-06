---
title: Hydrogen
localized_titles:
  sk: Vodík
type: concept
created: 2026-09-06
updated: 2026-09-06
sources: []
tags: [atomic-physics]
primary_branch: atomic-physics
branches: [atomic-physics]
visualizations:
  - id: explorer
    titles:
      en: Hydrogen atom — 1s and 2p_z states
      sk: Atóm vodíka — stavy 1s a 2p_z
    specification: Assets/concepts/hydrogen/explorer.v2.json
scientific_model:
  generated: Assets/concepts/hydrogen/generated.v1.json
  downloads:
    - path: Assets/concepts/hydrogen/model.v1.json
      labels: {en: Model definition (JSON), sk: Definícia modelu (JSON)}
    - path: Assets/concepts/hydrogen/atom.qcschema.json
      labels: {en: Atomic structure (QCSchema), sk: Atómová štruktúra (QCSchema)}
    - path: Assets/concepts/hydrogen/scene.usda
      labels: {en: Composed scene (OpenUSD), sk: Zložená scéna (OpenUSD)}
    - path: Assets/concepts/hydrogen/hydrogen-bundle.zip
      labels: {en: Complete model bundle (ZIP), sk: Úplný balík modelu (ZIP)}
    - path: Assets/concepts/hydrogen/generated.v1.json
      labels: {en: Generation record (JSON), sk: Záznam generovania (JSON)}
---

# Hydrogen

## English

Hydrogen is the chemical element with one proton in its nucleus. A neutral hydrogen atom, H, has one electron; the isotope shown here has no neutron. Molecular hydrogen, H<sub>2</sub>, consists of two bonded hydrogen atoms. A hydrogen ion, H<sup>+</sup>, has lost its electron; in water it interacts with surrounding water molecules.

The model shows the stationary 1s ground state and the 2p<sub>z</sub> excited state of an isolated hydrogen atom. The surface encloses 90% of the electron's position probability; the remaining 10% lies outside. It is not an electron orbit or a hard boundary. The two lobes of the 2p<sub>z</sub> state are separated by a plane with zero probability density.

In [[Concepts/mitochondria|mitochondria]], ATP synthase uses a proton electrochemical gradient. Those protons are H<sup>+</sup> in an aqueous environment, not the isolated neutral atoms or atomic orbitals shown here. [John E. Walker, Nobel lecture](https://www.nobelprize.org/uploads/2024/06/walker-nobel-lecture.pdf)

## Slovenčina

Vodík je chemický prvok s jedným protónom v jadre. Neutrálny atóm vodíka, H, má jeden elektrón; zobrazený izotop nemá neutrón. Molekulový vodík, H<sub>2</sub>, tvoria dva viazané atómy vodíka. Vodíkový ión, H<sup>+</sup>, stratil elektrón; vo vode interaguje s okolitými molekulami vody.

Model zobrazuje stacionárny základný stav 1s a excitovaný stav 2p<sub>z</sub> izolovaného atómu vodíka. Plocha ohraničuje oblasť s 90 % pravdepodobnosťou polohy elektrónu; zvyšných 10 % leží mimo nej. Nie je to dráha elektrónu ani pevná hranica. Dva laloky stavu 2p<sub>z</sub> oddeľuje rovina s nulovou hustotou pravdepodobnosti.

V [[Concepts/mitochondria|mitochondriách]] ATP syntáza využíva elektrochemický gradient protónov. Tieto protóny sú H<sup>+</sup> vo vodnom prostredí, nie izolované neutrálne atómy ani atómové orbitály zobrazené v tomto modeli. [John E. Walker, Nobelova prednáška](https://www.nobelprize.org/uploads/2024/06/walker-nobel-lecture.pdf)

## Model definition

An analytical, nonrelativistic hydrogen model with a fixed point proton and one electron, without an applied field. Spin-dependent and radiative effects are omitted. The 1s and 2p<sub>z</sub> states share the same physical scale and proton-centred coordinates. The probability density is stationary: this view does not simulate a transition between states or an electron trajectory. Colour is illustrative; both lobes show nonnegative probability density.

The densities are ρ<sub>1s</sub> = exp(−2r)/π and ρ<sub>2p_z</sub> = z² exp(−r)/(32π), with r and z measured in bohr and ρ in bohr<sup>−3</sup>. Here r is the distance from the proton and z is the coordinate along the orbital axis. Each surface bounds the region ρ ≥ its threshold whose probability integrates to 0.9 over all space; the threshold is not normalized to a cropped grid.

The scientific definition and QCSchema record are the model inputs. OpenUSD composes the generated geometry; the interactive view uses derived GLB scenes. The complete ZIP includes the USD layers needed by the composition. Lengths are recorded in bohr in the analytical definition, ångströms in USD, and metres in GLB; one ångström is 10<sup>−10</sup> m.

## Definícia modelu

Analytický, nerelativistický model vodíka s pevným bodovým protónom a jedným elektrónom bez vonkajšieho poľa. Nezahŕňa spinové ani radiačné efekty. Stavy 1s a 2p<sub>z</sub> majú rovnakú fyzikálnu mierku a súradnice so stredom v protóne. Hustota pravdepodobnosti je stacionárna: zobrazenie nesimuluje prechod medzi stavmi ani dráhu elektrónu. Farba je ilustračná; oba laloky zobrazujú nezápornú hustotu pravdepodobnosti.

Hustoty sú ρ<sub>1s</sub> = exp(−2r)/π a ρ<sub>2p_z</sub> = z² exp(−r)/(32π), kde r a z sú v bohroch a ρ v bohr<sup>−3</sup>. Veličina r je vzdialenosť od protónu a z je súradnica pozdĺž osi orbitálu. Každá plocha ohraničuje oblasť ρ ≥ príslušný prah, ktorej pravdepodobnosť sa integruje na 0,9 v celom priestore; prah sa nenormalizuje na orezanú mriežku.

Vstupmi modelu sú vedecká definícia a záznam QCSchema. OpenUSD skladá vygenerovanú geometriu; interaktívne zobrazenie používa odvodené scény GLB. Úplný ZIP obsahuje vrstvy USD potrebné na zostavenie scény. Dĺžky sú v analytickej definícii v bohroch, v USD v ångströmoch a v GLB v metroch; jeden ångström je 10<sup>−10</sup> m.
