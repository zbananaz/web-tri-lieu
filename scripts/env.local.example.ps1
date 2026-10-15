# Tuy chon. Sao chep thanh scripts\env.local.ps1 (file do bi .gitignore, chi co hieu luc tren may cua ban).
# env.ps1 se tu nap file do.
#
# Dat WTL_TOOL_DIR neu muon gom cache va cong cu vao mot thu muc rieng (vd o D de khong lam day o C):
#   <WTL_TOOL_DIR>\cache\...          cache npm, pnpm, corepack, tmp
#   <WTL_TOOL_DIR>\PostgreSQL\pgsql   PostgreSQL portable (giai nen ban zip cua EDB), co thu muc bin
#   <WTL_TOOL_DIR>\PostgreSQL\data    du lieu DB (neu khong dat PGDATA)
#   <WTL_TOOL_DIR>\pnpm\node_modules\.bin   pnpm cai bang "npm install --prefix <WTL_TOOL_DIR>\pnpm pnpm" (neu co)
#   <WTL_TOOL_DIR>\ms-playwright      trinh duyet cho Playwright
# Khong dat bien nay thi dung node/pnpm/PostgreSQL san co tren PATH, DB nam o <repo>\data\pgdata.
$env:WTL_TOOL_DIR = 'D:\Tool'

# Cac bien khac (tuy chon):
# $env:PGDATA = 'D:\duong-dan-khac\pgdata'   # noi luu du lieu DB
# $env:PGPORT = '54329'                      # cong PostgreSQL (mac dinh 54329; phai khop DATABASE_URL trong .env)
