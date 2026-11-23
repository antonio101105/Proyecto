# Chuleta CLI Headscale — PHANTOM

> **Contenedor:** `phantom-headscale`  
> **API:** `http://82.70.74.120:8085`  
> **Panel Admin:** `http://100.71.200.103:8086` (Nginx proxy)

## Nodos

```bash
# Listar todos los nodos
docker exec phantom-headscale headscale nodes list

# Ver detalles de un nodo
docker exec phantom-headscale headscale nodes get -i <node_id>

# Renombrar nodo
docker exec phantom-headscale headscale nodes rename -i <node_id> -n <nuevo_nombre>

# Mover nodo a namespace
docker exec phantom-headscale headscale nodes move -i <node_id> -n <namespace>

# Expulsar / eliminar nodo
docker exec phantom-headscale headscale nodes delete -i <node_id>

# Listar nodos por tag
docker exec phantom-headscale headscale nodes list --tags
```

## Preauthkeys (Claves de pre-autorización)

```bash
# Crear preauthkey reutilizable (expira en 72h)
docker exec phantom-headscale headscale preauthkeys create --reusable --expiration 72h

# Crear preauthkey efímera (un solo uso, expira en 1h)
docker exec phantom-headscale headscale preauthkeys create --ephemeral --expiration 1h

# Listar preauthkeys
docker exec phantom-headscale headscale preauthkeys list

# Revocar preauthkey
docker exec phantom-headscale headscale preauthkeys delete -i <key_id>

# Ver uso de una preauthkey
docker exec phantom-headscale headscale preauthkeys list --used
```

## Usuarios y Namespaces

```bash
# Crear usuario
docker exec phantom-headscale headscale users create -u <username>

# Listar usuarios
docker exec phantom-headscale headscale users list

# Renombrar usuario
docker exec phantom-headscale headscale users rename -u <old> -n <new>

# Eliminar usuario
docker exec phantom-headscale headscale users delete -u <username>

# Listar namespaces
docker exec phantom-headscale headscale namespaces list

# Crear namespace
docker exec phantom-headscale headscale namespaces create -n <name>

# Mover usuario a namespace
docker exec phantom-headscale headscale users move -u <username> -n <namespace>
```

## API Keys (para integración CI/CD)

```bash
# Crear API key (sin expiración)
docker exec phantom-headscale headscale apikeys create --description "CI/CD PHANTOM"

# Crear API key con expiración (ej. 90 días)
docker exec phantom-headscale headscale apikeys create --expiration 90d --description "Monitoring"

# Listar API keys
docker exec phantom-headscale headscale apikeys list

# Revocar API key
docker exec phantom-headscale headscale apikeys delete -i <key_id>
```

## Rutas (Routes)

```bash
# Listar rutas anunciadas
docker exec phantom-headscale headscale routes list

# Aprobar ruta (subnet router)
docker exec phantom-headscale headscale routes approve -i <route_id>

# Denegar ruta
docker exec phantom-headscale headscale routes deny -i <route_id>

# Eliminar ruta
docker exec phantom-headscale headscale routes delete -i <route_id>
```

## Políticas ACL

```bash
# Ver ACLs actuales
docker exec phantom-headscale headscale acls get

# Establecer ACLs (desde archivo)
docker exec -i phantom-headscale headscale acls set < /path/to/acl.hujson

# Validar sintaxis ACLs antes de aplicar
docker exec phantom-headscale headscale acls validate < /path/to/acl.hujson
```

## Políticas de Derivación (Derp Maps)

```bash
# Ver mapa DERP
docker exec phantom-headscale headscale derpmap get
```

## Namespace & Tenancy

```bash
# Ver namespaces
docker exec phantom-headscale headscale namespaces list

# Ver miembros de namespace
docker exec phantom-headscale headscale namespaces members -n <namespace>
```

## Logs y Debug

```bash
# Ver logs del contenedor
docker logs -f phantom-headscale

# Ver logs con tail
docker logs --tail 100 phantom-headscale

# Ejecutar comando interactivo en contenedor
docker exec -it phantom-headscale sh
```

## Backup y Restore

```bash
# Backup base de datos Headscale
docker exec phantom-headscale sqlite3 /var/lib/headscale/db.sqlite .dump > headscale-backup.sql

# Restore (contenedor detenido)
docker exec -i phantom-headscale sqlite3 /var/lib/headscale/db.sqlite < headscale-backup.sql
```

## Auditoría Rápida de Aislamiento

```bash
# Verificar que sondas NO se ven entre sí
docker exec phantom-headscale headscale nodes list --tags | grep "tag:sonda"

# Verificar rutas permitidas
docker exec phantom-headscale headscale acls get | jq '.acls[] | select(.action=="accept")'

# Verificar denegaciones
docker exec phantom-headscale headscale acls get | jq '.acls[] | select(.action=="deny")'
```

## Comandos Combinados Útiles

```bash
# Dar de alta nueva sonda completa (preauthkey + verificación)
docker exec phantom-headscale headscale preauthkeys create --reusable --expiration 72h --tags tag:sonda

# Ver todos los nodos con sus IPs Tailnet
docker exec phantom-headscale headscale nodes list | awk '/100\./ {print $2, $3, $4}'

# Exportar configuración completa
docker exec phantom-headscale headscale config show
```

## Referencias Rápidas

| Recurso | Comando |
|---------|---------|
| Panel Admin Web | http://100.71.200.103:8086 |
| API Headscale | http://82.70.74.120:8085 |
| Contenedor | `phantom-headscale` |
| DB | `/var/lib/headscale/db.sqlite` |
| Config | `/etc/headscale/config.yaml` |
| ACLs | `/etc/headscale/acl.hujson` |
| Logs | `docker logs -f phantom-headscale` |
