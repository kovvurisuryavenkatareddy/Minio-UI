import BucketList from "@/components/BucketList";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 pt-10 relative">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">
          MinIO Bucket Explorer
        </h1>
        <BucketList />
      </div>
      <div className="absolute bottom-0 p-4">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;