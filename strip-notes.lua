-- Entfernt Sprechernotizen (::: notes) aus der Ausgabe. Wird nur im Profil "dev" genutzt.
function Div(el)
  if el.classes:includes("notes") then
    return {}
  end
end
