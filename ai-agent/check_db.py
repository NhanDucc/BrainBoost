import chromadb

# Trỏ tới thư mục chứa database của bạn
client = chromadb.PersistentClient(path="./chroma_db")

print("=== BRAINBOOST CHROMADB INSPECTOR ===")
collections = client.list_collections()

if not collections:
    print("No collections found.")
else:
    for col in collections:
        print(f"\n📁 Collection Name: {col.name}")
        print(f"📊 Total Embeddings (Chunks): {col.count()}")
        
        # Lấy thử 1 chunk đầu tiên để show dữ liệu mẫu
        peek_data = col.peek(1)
        if peek_data['ids']:
            print(f"🆔 Sample ID: {peek_data['ids'][0]}")
            print(f"📄 Sample Text: {peek_data['documents'][0][:100]}...")
print("\n=====================================")