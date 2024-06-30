import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, Select, Table } from "antd";
import axios from "axios";
import { Line } from "@ant-design/charts";

type TCurrency = "USD" | "EUR" | "BRL";

interface ICurrency {
  value: TCurrency;
  label: string;
  localeString: string;
}

type TMarketCap = "market_cap_desc" | "market_cap_asc";

type TPageSize = 5 | 10 | 20 | 50 | 100;

type TCoingeckoData = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string; //stringDate
  atl: number;
  atl_change_percentage: number;
  atl_date: string; //stringDate
  roi: null;
  last_updated: string; //stringDate
  sparkline_in_7d: {
    price: number[];
  };
};

type TCryptoCurrency = {
  name: string;
  image: string;
  currencyPrice: TCurrency;
  currentPrice: number;
  circulatingSupply: number;
  timeSeries: number[];
};

type TColumns<T> = {
  title: string;
  dateIndex: string;
  key: keyof T;
  render?: (text: unknown, record: T, index: number) => JSX.Element;
  width: string | number;
};

// const Row: React.FC = () => {

// }

/*
  Name: Leandro Queiroz
  As I need to make in just one file I will style-inline
*/

const TOTAL_PAGE = 1000;

const handleLocaleCurrency = (price: number, currency: TCurrency) => {
  let { localeString, value } =
    currencySelectOptions[currencyValueToIndex[currency]];
  return price.toLocaleString(localeString, {
    style: "currency",
    currency: value,
  });
};

const currencySelectOptions: ICurrency[] = [
  { value: "USD", label: "USD", localeString: "en-US" },
  { value: "EUR", label: "EUR", localeString: "en-EU" },
  { value: "BRL", label: "BRL", localeString: "pt-BR" },
];

const currencyValueToIndex: { [K in TCurrency]: number } = {
  USD: 0,
  EUR: 1,
  BRL: 2,
};

const marketCapSelectOptions: { value: TMarketCap; label: string }[] = [
  { value: "market_cap_asc", label: "Market cap ascending" },
  { value: "market_cap_desc", label: "Market cap descending" },
];

const paginationSizeOptions: TPageSize[] = [5, 10, 20, 50, 100];

const CurrencyNameWithImage = ({
  name,
  image,
}: {
  name: string;
  image: string;
}) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <Image width={32} height={32} src={image} />
      <p>{name}</p>
    </div>
  );
};
const LineChart = ({
  timeSeries,
  onClick = () => {},
  height,

  small,
}: {
  timeSeries?: number[];
  small: boolean;
  onClick?: () => void;
  height?: number;
}) => {
  const chartData: { date: Date; price: number }[] = [];
  const accuracy: "hour" | "day" = small ? "day" : "hour";
  const chartAccuracy = accuracy === "hour" ? 1 : 24;
  const date = new Date();
  date.setMinutes(0, 0, 0);

  if (!timeSeries) return <></>;

  for (let i = timeSeries.length - chartAccuracy; i >= 0; i--) {
    let price = timeSeries[i];
    chartData.push({ date: new Date(date), price: price });
    date.setHours(date.getHours() - 1);
  }

  return (
    <div onClick={onClick}>
      <Line
        data={chartData}
        height={height}
        xField="date"
        yField="price"
        label={null}
        axis={{
          x: small ? { line: null, label: null, tickCount: 0 } : undefined,
          y: small ? { line: null, label: null, tickCount: 0 } : undefined,
        }}
      />
    </div>
  );
};

const nameColumn: TColumns<TCryptoCurrency> = {
  title: "Name",
  dateIndex: "name",
  key: "name",
  width: "25%",
  render: (_, { name, image }: TCryptoCurrency) => {
    return <CurrencyNameWithImage name={name} image={image} />;
  },
};

const currentPriceColumn: TColumns<TCryptoCurrency> = {
  title: "Current Price",
  key: "currentPrice",
  dateIndex: "currentPrice",
  width: "25%",

  render: (_, { currentPrice, currencyPrice }: TCryptoCurrency) => (
    <p>{handleLocaleCurrency(currentPrice, currencyPrice)}</p>
  ),
};

const circulationSupplyColumn: TColumns<TCryptoCurrency> = {
  title: "Circulating Supply",
  key: "circulatingSupply",
  dateIndex: "circulatingSupply",
  width: "25%",

  render: (_, { circulatingSupply }: TCryptoCurrency) => (
    <p>{circulatingSupply}</p>
  ),
};

const timeSeriesColumn = (
  onClick: (index: number) => void
): TColumns<TCryptoCurrency> => {
  return {
    title: "Chart",
    key: "timeSeries",
    dateIndex: "timeSeries",
    width: "25%",
    render: (_: any, { timeSeries }: TCryptoCurrency, index: number) => (
      <LineChart
        timeSeries={timeSeries}
        small={true}
        height={100}
        onClick={() => {
          onClick(index);
        }}
      />
    ),
  };
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [openChartModal, setOpenChartModal] = useState(false);
  const [cryptoCurrencyChartIndex, setCryptoCurrencyChartIndex] = useState(0);
  const [cryptoCurrencyChart, setCryptoCurrencyChart] =
    useState<TCryptoCurrency>();
  const [currency, setCurrency] = useState<TCurrency>("USD");
  const [marketCap, setMarketCap] = useState<TMarketCap>("market_cap_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TPageSize>(10);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<TCryptoCurrency[]>(
    []
  );
  const [modalLoading, setModalLoading] = useState(false);

  const handleTableChartClick = useCallback((index: number) => {
    setOpenChartModal(true);
    setModalLoading(true);
    setCryptoCurrencyChartIndex(index);
  }, []);

  useEffect(() => {
    if (openChartModal) {
      try {
        setCryptoCurrencyChart(cryptoCurrencies[cryptoCurrencyChartIndex]);
      } catch (error) {
        setOpenChartModal(false);
        console.log("Unexistent chart");
      } finally {
        setModalLoading(false);
      }
    }
  }, [openChartModal, cryptoCurrencies, cryptoCurrencyChartIndex]);

  const cryptoTableColumn: TColumns<TCryptoCurrency>[] = useMemo(() => {
    const columns = [nameColumn, currentPriceColumn];

    if (window.innerWidth > 480) {
      columns.push(circulationSupplyColumn);
    }

    if (window.innerWidth > 768) {
      columns.push(timeSeriesColumn(handleTableChartClick));
    }
    return columns;
  }, [handleTableChartClick]);

  const [tableError, setTableError] = useState(false);

  const fetchCryptoCurrencyData = useCallback(async () => {
    try {
      setLoading(true);
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=${marketCap}&per_page=${pageSize}&page=${page}&sparkline=true`;
      const cryptoCurrency = await axios.get(url);
      const data: TCoingeckoData[] = cryptoCurrency.data;
      const cryptoCurrenciesData: TCryptoCurrency[] = [];

      data.forEach((cryptoCurrency) => {
        const {
          name,
          image,
          current_price,
          circulating_supply,
          sparkline_in_7d: { price },
        } = cryptoCurrency;

        cryptoCurrenciesData.push({
          name: name,
          image: image,
          circulatingSupply: circulating_supply,
          currencyPrice: currency,
          currentPrice: current_price,
          timeSeries: price,
        });
      });

      console.log(cryptoCurrenciesData);

      setCryptoCurrencies(cryptoCurrenciesData);
    } catch (error) {
      setTableError(true);
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [currency, marketCap, pageSize, page]);

  useEffect(() => {
    fetchCryptoCurrencyData();
  }, [fetchCryptoCurrencyData]);

  const handleChartModelClose = () => {
    setOpenChartModal(false);
    setCryptoCurrencyChart(undefined);
  };

  return (
    <div style={{ width: "calc(100% - 2rem - 2rem)", margin: "auto" }}>
      <h1 style={{ margin: "unset", padding: "34px 0px" }}>Coins & Markets</h1>

      {!tableError ? (
        <>
          <div
            style={{
              display: "flex",
              textAlign: "initial",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            <Select
              value={currency}
              style={{ width: "200px" }}
              onChange={(value) => {
                setCurrency(value);
              }}
              options={currencySelectOptions}
            />
            <Select
              value={marketCap}
              style={{ width: "200px" }}
              onChange={(value) => {
                setMarketCap(value);
              }}
              options={marketCapSelectOptions}
            />
          </div>

          <div>
            <Table
              sticky={true}
              loading={loading}
              dataSource={cryptoCurrencies}
              columns={cryptoTableColumn}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: TOTAL_PAGE,
                onChange: (newPage, newPageSize) => {
                  setPage(newPage);
                  setPageSize(newPageSize as TPageSize);
                },
                pageSizeOptions: paginationSizeOptions,
              }}
            />
          </div>
        </>
      ) : (
        <h2>Was't possible get data. Coingecko API not Working</h2>
      )}

      <Modal
        loading={modalLoading}
        open={openChartModal}
        width={"fit-content"}
        style={{ minWidth: "640px" }}
        footer={[]}
        title={
          cryptoCurrencyChart ? (
            <CurrencyNameWithImage
              name={cryptoCurrencyChart.name}
              image={cryptoCurrencyChart.image}
            />
          ) : (
            "Title"
          )
        }
        onCancel={handleChartModelClose}
      >
        <LineChart small={false} timeSeries={cryptoCurrencyChart?.timeSeries} />
      </Modal>
    </div>
  );
};

export default App;
