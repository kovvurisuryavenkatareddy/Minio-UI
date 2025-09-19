import BucketList from "@/components/BucketList";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">
          My Buckets
        </h1>
        <BucketList />
      </div>
      <div className="mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;