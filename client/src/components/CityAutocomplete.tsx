import { useState, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  locale?: string;
  className?: string;
  disabled?: boolean;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder,
  locale = 'en',
  className,
  disabled = false,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const defaultPlaceholder = locale === 'ru' ? 'Введите город' : 'Enter city';

  useEffect(() => {
    const fetchCities = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setCities([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/cities/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await response.json();
        
        if (data.ok) {
          setCities(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch cities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          data-testid="button-city-autocomplete"
        >
          {value || placeholder || defaultPlaceholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={locale === 'ru' ? 'Поиск города...' : 'Search city...'}
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid="input-city-search"
          />
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {locale === 'ru' ? 'Загрузка...' : 'Loading...'}
              </div>
            )}
            {!isLoading && searchQuery.length >= 2 && cities.length === 0 && (
              <CommandEmpty>
                {locale === 'ru' ? 'Город не найден' : 'No city found'}
              </CommandEmpty>
            )}
            {!isLoading && cities.length > 0 && (
              <CommandGroup>
                {cities.map((city) => (
                  <CommandItem
                    key={city}
                    value={city}
                    onSelect={() => {
                      onChange(city);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    data-testid={`city-option-${city}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === city ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {city}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
