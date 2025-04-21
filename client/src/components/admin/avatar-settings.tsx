import { useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAvatar } from "@/hooks/use-avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function AvatarSettings() {
  const { t } = useLanguage();
  const { avatar, isLoading, saveAvatarMutation, resetAvatarMutation } = useAvatar();
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Name is too long"),
    image: z.any().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: avatar?.name || "Bot ToledoIA",
      image: undefined,
    },
  });

  // Update form when avatar data is loaded
  useState(() => {
    if (avatar) {
      form.reset({
        name: avatar.name,
        image: undefined,
      });
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const fileInput = fileInputRef.current;
    const file = fileInput?.files?.[0];
    
    await saveAvatarMutation.mutateAsync({ 
      name: values.name,
      image: file
    });
    
    // Reset the file input and preview after save
    if (fileInput) {
      fileInput.value = "";
    }
    setPreviewImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      form.setError("image", {
        type: "manual",
        message: "Image size must be less than 5MB",
      });
      return;
    }
    
    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      form.setError("image", {
        type: "manual",
        message: "Only JPG and PNG images are allowed",
      });
      return;
    }
    
    // Create a preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleResetAvatar = async () => {
    await resetAvatarMutation.mutateAsync();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPreviewImage(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.avatarSettings")}</CardTitle>
          <CardDescription>{t("admin.avatarSettingsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.avatarSettings")}</CardTitle>
        <CardDescription>{t("admin.avatarSettingsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3">
                <FormLabel>{t("admin.avatarImage")}</FormLabel>
                <div className="bg-neutral-100 border border-dashed border-neutral-300 rounded-lg p-4 text-center mt-3">
                  <div className="mb-3">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Avatar Preview"
                        className="w-24 h-24 rounded-full mx-auto object-cover"
                      />
                    ) : avatar?.image_url ? (
                      <img
                        src={avatar.image_url}
                        alt={avatar.name}
                        className="w-24 h-24 rounded-full mx-auto object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-primary-100 mx-auto flex items-center justify-center text-primary-600">
                        <span className="text-2xl font-bold">T</span>
                      </div>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="image"
                    render={() => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept=".jpg,.jpeg,.png"
                            className="hidden"
                            aria-label="Upload avatar image"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-300 inline-block"
                        >
                          {t("admin.changeImage")}
                        </Button>
                        <p className="mt-2 text-xs text-neutral-500">
                          {t("admin.avatarImageRequirements")}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="md:w-2/3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.avatarName")}</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={50} />
                      </FormControl>
                      <p className="mt-1 text-xs text-neutral-500">
                        {t("admin.maxCharacters")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="mt-6">
                  <FormLabel>{t("admin.avatarPreview")}</FormLabel>
                  <div className="bg-neutral-50 p-4 border rounded-md mt-1">
                    <div className="flex items-start">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3">
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt="Avatar Preview"
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : avatar?.image_url ? (
                          <img
                            src={avatar.image_url}
                            alt={avatar.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold">T</span>
                        )}
                      </div>
                      <div className="bg-neutral-100 rounded-lg rounded-tl-none py-2 px-3 max-w-[80%]">
                        <p className="text-neutral-800 text-sm">
                          {t("technician.botWelcome")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                className="mr-2"
                onClick={handleResetAvatar}
                disabled={resetAvatarMutation.isPending}
              >
                {resetAvatarMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("admin.resetDefault")}
              </Button>
              <Button
                type="submit"
                disabled={saveAvatarMutation.isPending}
              >
                {saveAvatarMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("admin.saveAvatar")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
