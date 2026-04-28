# Perpignan

## Como abrir la app

La forma mas simple es hacer doble click en:

```text
iniciar-pizzeria.bat
```

Cuando la ventana quede abierta, entrar desde esta computadora a:

```text
http://localhost:3000
```

Desde otro telefono o computadora de la misma red, entrar a:

```text
http://192.168.1.6:3000
```

Es importante escribir `http://` al principio. Si el celular intenta abrir `https://192.168.1.6:3000`, va a mostrar un error de conexion segura porque este servidor local no usa HTTPS.

Si Windows pregunta por permisos de firewall para Node.js, permitir el acceso en redes privadas.

## Si queres usar comandos

No hace falta `npm`. Esta app no usa paquetes externos por ahora.

```powershell
cd "C:\Users\river\Documents\New project"
node server.js
```

Si `node` tampoco aparece como comando reconocido, instala Node.js LTS desde:

```text
https://nodejs.org/
```

## Donde se guardan los datos

Los gustos, precios, promociones y configuracion se guardan localmente en:

```text
data\db.json
```
